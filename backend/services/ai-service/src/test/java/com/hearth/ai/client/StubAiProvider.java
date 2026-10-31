package com.hearth.ai.client;

import com.fasterxml.jackson.databind.node.TextNode;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * A stand-in for the chat-completions AI endpoint on a local port. Tests queue the replies it gives and read
 * the requests it received, so they can check exactly what Hearth sends out.
 */
public final class StubAiProvider implements AutoCloseable {

    public record Received(String authorization, String body) {
    }

    private record Answer(int status, String body) {
    }

    private final HttpServer server;
    private final Deque<Answer> answers = new ArrayDeque<>();
    private final List<Received> received = new ArrayList<>();

    public StubAiProvider() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat/completions", exchange -> {
            String body;
            try (InputStream in = exchange.getRequestBody()) {
                body = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
            Answer answer;
            synchronized (this) {
                received.add(new Received(exchange.getRequestHeaders().getFirst("Authorization"), body));
                answer = answers.isEmpty() ? new Answer(500, "{\"error\":{\"message\":\"empty queue\"}}") : answers.poll();
            }
            byte[] bytes = answer.body().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(answer.status(), bytes.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });
        server.start();
    }

    public String url() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    /** Queue a forced tool call whose arguments JSON is {@code inputJson}. */
    public synchronized StubAiProvider replyWithTool(String toolName, String inputJson) {
        String escapedArgs = TextNode.valueOf(inputJson).toString();
        answers.add(new Answer(200, """
                {"id":"chatcmpl_test","object":"chat.completion","model":"test",
                 "choices":[{"index":0,"finish_reason":"tool_calls",
                   "message":{"role":"assistant","tool_calls":[{"id":"call_1","type":"function",
                     "function":{"name":"%s","arguments":%s}}]}}],
                 "usage":{"prompt_tokens":900,"completion_tokens":150}}
                """.formatted(toolName, escapedArgs)));
        return this;
    }

    public synchronized StubAiProvider replyWithText(String text) {
        answers.add(new Answer(200, """
                {"id":"chatcmpl_test","object":"chat.completion","model":"test",
                 "choices":[{"index":0,"finish_reason":"stop",
                   "message":{"role":"assistant","content":%s}}],
                 "usage":{"prompt_tokens":300,"completion_tokens":80}}
                """.formatted(TextNode.valueOf(text).toString())));
        return this;
    }

    public synchronized StubAiProvider replyWithStatus(int status) {
        answers.add(new Answer(status, "{\"error\":{\"type\":\"test\",\"message\":\"stub\"}}"));
        return this;
    }

    public synchronized List<Received> received() {
        return List.copyOf(received);
    }

    public synchronized void reset() {
        answers.clear();
        received.clear();
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
