import { describe, expect, it } from "vitest";
import { readBoundedWebhookBody, WebhookBodyTooLargeError } from "./readBody";

function request(chunks: Uint8Array[], headers?: HeadersInit): Request {
  let index = 0;
  return new Request("https://localhost/api/sentinel/webhook", {
    method: "POST", headers, duplex: "half",
    body: new ReadableStream<Uint8Array>({
      pull(controller) {
        if (index === chunks.length) controller.close();
        else controller.enqueue(chunks[index++]);
      },
    }),
  } as RequestInit);
}

const encode = (s: string) => new TextEncoder().encode(s);

describe("bounded Sentinel webhook streaming", () => {
  it("accepts an exact 64 KiB body", async () => {
    expect((await readBoundedWebhookBody(request([encode("x".repeat(65536))]), 65536)).length).toBe(65536);
  });
  it("rejects the next byte without relying on Content-Length", async () => {
    await expect(readBoundedWebhookBody(request([encode("x".repeat(65536)), encode("y")]), 65536)).rejects.toBeInstanceOf(WebhookBodyTooLargeError);
  });
  it("rejects a multibyte payload exceeding the byte limit", async () => {
    await expect(readBoundedWebhookBody(request([encode("😀".repeat(16385))]), 65536)).rejects.toBeInstanceOf(WebhookBodyTooLargeError);
  });
  it("enforces actual bytes despite a misleading Content-Length", async () => {
    await expect(readBoundedWebhookBody(request([encode("x".repeat(100))], { "Content-Length": "1" }), 64)).rejects.toBeInstanceOf(WebhookBodyTooLargeError);
  });
  it("decodes UTF-8 split across chunk boundaries", async () => {
    const bytes = encode("hello 😀");
    expect(await readBoundedWebhookBody(request([bytes.subarray(0, 7), bytes.subarray(7)]), 32)).toBe("hello 😀");
  });
  it("rejects invalid UTF-8 rather than silently replacing bytes", async () => {
    await expect(readBoundedWebhookBody(request([new Uint8Array([0xff])]), 64)).rejects.toThrow();
  });
});
