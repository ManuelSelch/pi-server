# Extension embedding

```ts
import { createPiServer } from '@manuelselch/pi-server';
import { getPiChatExtensionRegistry } from '@manuelselch/pi-server/extensions';

const extensions = getPiChatExtensionRegistry();
extensions.registerButton({
  id: 'example.action', slot: 'composer.right', label: 'Example', actionId: 'example.run',
});
const server = createPiServer({ extensions });
server.httpServer.listen(8788, '127.0.0.1');
// On application shutdown: await server.close();
```

- Keep registration names and `Symbol.for("pi-chat.extension-registry")`: extension packages and the host share the process-wide registry. Do not create a second registry/protocol implementation merely because the server moved repositories.
- Register extension-bearing local Pi packages explicitly by path; sources need not live under the auto-discovery directory. Existing user registration paths/settings are not moved by extraction. Do not import Chat or private server source/distribution paths.
- Public `/extensions` exports the production registry/types, not test reset. `/testing` exposes fake runtime/data/reset for tests; `/testing/loopback` is a compiled isolated fixture, not a general production launcher.
- The application renders optional presentation; runtime ownership is independent of tabs/focus. Disconnect/hide do not close runtimes. Follow the SDK v2 lifecycle and use explicit `session.close` when appropriate.
