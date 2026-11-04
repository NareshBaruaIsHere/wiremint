import { createServer } from "node:net";

/**
 * Checks whether a specific TCP port is currently free to bind.
 */
export async function isPortAvailable(
  port: number,
  host: string = "127.0.0.1",
): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => {
        resolve(true);
      });
    });

    server.listen(port, host);
  });
}

