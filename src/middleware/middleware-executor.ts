import { ServerError } from "../core/errors.js";
import type { Middleware, MiddlewareContext, NextFunction } from "./types.js";

/**
 * Execute an array of middleware functions in registration order following the onion pattern.
 * When all middleware calls next(), the terminal handler is invoked.
 */
export async function executeMiddlewarePipeline(
  middlewares: Middleware[],
  context: MiddlewareContext,
  handler: () => Promise<void>,
): Promise<void> {
  let lastIndex = -1;

  async function dispatch(index: number): Promise<void> {
    if (index <= lastIndex) {
      throw new ServerError("next() called multiple times in middleware");
    }
    lastIndex = index;

    if (index === middlewares.length) {
      await handler();
      return;
    }

    const middleware = middlewares[index];
    let nextCalled = false;

    const next: NextFunction = async () => {
      if (nextCalled) {
        throw new ServerError("next() called multiple times in middleware");
      }
      nextCalled = true;
      await dispatch(index + 1);
    };

    await middleware(context, next);

    // If middleware finished without calling next()
    if (!nextCalled) {
      const hasResponse =
        context.statusCode !== undefined || context.responseBody !== undefined;
      if (!hasResponse) {
        throw new ServerError(
          "Middleware terminated without calling next() and without producing a response",
        );
      }
      if (context.statusCode === undefined) {
        context.statusCode = 200;
      }
    }
  }

  await dispatch(0);
}

