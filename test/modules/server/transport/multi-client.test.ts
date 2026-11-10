import { afterEach, beforeEach, it } from "vitest";
import { MultiClientDriver } from "../../../infra/multi-client-driver.js";

let app: MultiClientDriver;
beforeEach(async () => { app = new MultiClientDriver(); await app.start(); });
afterEach(async () => { await app.close(); });

it("runs different sessions concurrently and broadcasts ordered events without leaking responses", async () => {
  await app.connect();
  await app.connect();
  await app.openAnotherSession();

  await app.sendSimultaneously();

  await app.shouldReceiveBothRuns();
});

it("filters snapshots and optional operations independently for each client", async () => {
  await app.connect();
  await app.connect([]);

  await app.publishSnapshot();

  await app.shouldFilterPresentation();
});

it("keeps prompts available until the last initialized client disconnects and resumes on reconnect", async () => {
  await app.connect();
  await app.connect();

  await app.disconnect(0);
  await app.shouldKeepPromptsAvailable();
  await app.disconnect(1);
  await app.shouldSuspendPrompts();
  await app.connect();
  app.shouldResumePrompts();
});

it("does not count uninitialized sockets as available clients", async () => {
  await app.connect();
  await app.connectUninitialized();

  await app.disconnect(1);
  app.shouldNotSuspendPrompts();
  await app.connectUninitialized();
  await app.disconnect(0);
  await app.shouldSuspendPrompts();
});

it("disconnects an overloaded client without preventing publication or work on another client", async () => {
  await app.connect();
  await app.connect();
  app.overloadFirstClient();

  await app.publishSnapshot(1);

  await app.shouldKeepSecondClientUsable();
});
