import { once } from "node:events";
import WebSocket from "ws";
import { expect, vi } from "vitest";
import type { Capability, SessionSnapshot } from "@manuelselch/pi-sdk/protocol";
import { createPiServer, type PiServer } from "../../src/index.js";
import { FakeRuntimeAdapter } from "./fake-runtime-adapter.js";
import { v2Socket } from "./v2-socket.js";
import { ProjectSessionService } from "../../src/projects/project-session-service.js";

export class MultiClientDriver {
  private server!: PiServer;
  private readonly runtimes = [new FakeRuntimeAdapter("first"), new FakeRuntimeAdapter("second")];
  private readonly clients: Awaited<ReturnType<typeof v2Socket>>[] = [];
  private readonly snapshots: SessionSnapshot[][] = [];
  private readonly resume = vi.spyOn(this.runtimes[0]!, "resumePrompts");
  private readonly suspend = vi.spyOn(this.runtimes[0]!, "suspendPrompts");
  private readonly releases: (() => void)[] = [];

  async start() {
    vi.spyOn(ProjectSessionService.prototype, "catalogue").mockResolvedValue({ projects: [] });
    vi.spyOn(ProjectSessionService.prototype, "rememberProject").mockResolvedValue(undefined);
    const second = this.runtimes[1]!;
    this.server = createPiServer({ runtime: this.runtimes[0], runtimeFactory: {
      newSession: async () => second, openSession: async () => second, continueProject: async () => second,
    } });
    await new Promise<void>(resolve => this.server.httpServer.listen(0, "127.0.0.1", resolve));
  }

  async connectUninitialized() {
    this.clients.push(await v2Socket(this.server));
  }

  async connect(capabilities: Capability[] = ["presentation"]) {
    const client = await v2Socket(this.server);
    this.clients.push(client);
    const initial = await client.initialize(capabilities);
    this.snapshots.push(initial.snapshots);
    expect(client.messages[0]).toMatchObject({ type: "response", requestId: "init", ok: true });
  }

  async openAnotherSession() {
    const client = this.clients[0]!;
    client.send("session.create", "create");
    expect(await client.response("create")).toMatchObject({ ok: true });
    await Promise.all(this.clients.map(client => client.wait(message => message.type === "event" && message.event === "session.list.changed" && message.data.sessions.length === 2)));
    for (const [index, connection] of this.clients.entries()) {
      connection.send("session.list", "list");
      const reply = await connection.response("list");
      if (!reply.ok) throw new Error(reply.error.message);
      const inventory = reply.result as { sessions: { sessionId: string }[] };
      connection.send("session.snapshot", "second-snapshot", {}, inventory.sessions[1]!.sessionId);
      const snapshot = await connection.response("second-snapshot");
      if (!snapshot.ok) throw new Error(snapshot.error.message);
      this.snapshots[index]!.push(snapshot.result as SessionSnapshot);
    }
  }

  async sendSimultaneously() {
    const gates = this.runtimes.map(runtime => {
      const original = runtime.prompt.bind(runtime);
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      this.releases.push(release);
      vi.spyOn(runtime, "prompt").mockImplementation(async text => { await gate; await original(text); });
      return release;
    });
    for (const [index, client] of this.clients.entries())
      client.send("message.send", "same-request-id", { message: `client-${index}` }, this.snapshots[index]![index]!.sessionId);
    for (const client of this.clients)
      expect(await client.response("same-request-id")).toMatchObject({ ok: true, result: { state: "accepted" } });
    for (const release of gates) release();
  }

  async shouldReceiveBothRuns() {
    for (const [index, client] of this.clients.entries()) {
      for (const snapshot of this.snapshots[index]!)
        await client.wait(message => message.type === "event" && message.event === "operation.finished" && message.sessionId === snapshot.sessionId);
      expect(client.messages.filter(message => message.type === "response" && message.requestId === "same-request-id")).toHaveLength(1);
      const events = client.messages.filter(message => message.type === "event" && "sequence" in message);
      for (const snapshot of this.snapshots[index]!) {
        const sequences = events.filter(message => "sessionId" in message && message.sessionId === snapshot.sessionId).map(message => "sequence" in message ? message.sequence : undefined);
        expect(sequences).toEqual(sequences.map((_, index) => index + 1));
      }
    }
    expect(this.runtimes[0]!.snapshot().messages[0]).toMatchObject({ text: "client-0" });
    expect(this.runtimes[1]!.snapshot().messages[0]).toMatchObject({ text: "client-1" });
  }

  async publishSnapshot(index = 0) {
    this.clients[index]!.send("thinking.level", "settings", { level: "off" }, this.snapshots[index]![0]!.sessionId);
    expect(await this.clients[index]!.response("settings")).toMatchObject({ ok: true });
  }

  async shouldFilterPresentation() {
    for (const [index, client] of this.clients.entries()) {
      const snapshot = this.snapshots[index]![0]!;
      expect("presentation" in snapshot).toBe(index === 0);
      const event = await client.wait(message => message.type === "event" && message.event === "session.snapshot");
      if (event.type !== "event" || event.event !== "session.snapshot") throw new Error("Expected snapshot");
      expect("presentation" in event.data).toBe(index === 0);
    }
    this.clients[1]!.send("file.open", "unsupported", { path: "anything" }, this.snapshots[1]![0]!.sessionId);
    expect(await this.clients[1]!.response("unsupported")).toMatchObject({ ok: false, error: { code: "unsupportedOperation" } });
  }

  async disconnect(index: number) {
    const client = this.clients[index]!;
    const closed = once(client.socket, "close");
    client.socket.close();
    await closed;
    // A surviving peer's response is a server-side event-loop barrier.
    const peer = this.clients.find(client => client.socket.readyState === WebSocket.OPEN && client.messages.some(message => message.type === "response" && message.requestId === "init" && message.ok));
    if (peer) {
      peer.send("server.ping", `disconnect-${index}`);
      expect(await peer.response(`disconnect-${index}`)).toMatchObject({ ok: true });
    }
  }

  async shouldKeepPromptsAvailable() {
    expect(this.resume).toHaveBeenCalledOnce();
    expect(this.suspend).not.toHaveBeenCalled();
    const pending = this.runtimes[0]!.uiContext().confirm("Proceed?", "Still connected");
    const client = this.clients[1]!;
    const event = await client.wait(message => message.type === "event" && message.event === "prompt.list.changed" && message.data.prompts.length > 0);
    if (event.type !== "event" || event.event !== "prompt.list.changed") throw new Error("Expected prompt");
    client.send("prompt.answer", "answer", { promptId: event.data.prompts[0]!.id, result: { cancelled: false, value: true } }, this.snapshots[1]![0]!.sessionId);
    expect(await client.response("answer")).toMatchObject({ ok: true });
    expect(await pending).toBe(true);
  }

  shouldNotSuspendPrompts() {
    expect(this.resume).toHaveBeenCalledOnce();
    expect(this.suspend).not.toHaveBeenCalled();
  }

  async shouldSuspendPrompts() {
    await vi.waitFor(() => expect(this.suspend).toHaveBeenCalledOnce());
  }

  shouldResumePrompts() { expect(this.resume).toHaveBeenCalledTimes(2); }

  overloadFirstClient() {
    const send = WebSocket.prototype.send;
    let first: WebSocket | undefined;
    vi.spyOn(WebSocket.prototype, "send").mockImplementation(function (this: WebSocket, ...args: Parameters<typeof send>) {
      const message = JSON.parse(String(args[0]));
      if (message.type === "event" && message.event === "settings.changed" && !first) {
        first = this;
        Object.defineProperty(this, "bufferedAmount", { get: () => 16_777_216, configurable: true });
      }
      return send.apply(this, args);
    });
  }

  async shouldKeepSecondClientUsable() {
    const client = this.clients[1]!;
    await client.wait(message => message.type === "event" && message.event === "settings.changed");
    await client.wait(message => message.type === "event" && message.event === "session.snapshot");
    client.send("server.ping", "survivor");
    expect(await client.response("survivor")).toMatchObject({ ok: true });
    await vi.waitFor(() => expect(this.clients[0]!.socket.readyState).toBe(WebSocket.CLOSED));
  }

  async close() {
    for (const release of this.releases) release();
    for (const client of this.clients) client.socket.terminate();
    if (this.server) await this.server.close();
    vi.restoreAllMocks();
  }
}
