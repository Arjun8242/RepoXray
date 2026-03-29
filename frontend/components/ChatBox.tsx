"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { postChatQuestion } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

type ChatBoxProps = {
  analysisId: string;
};

export function ChatBox({ analysisId }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || sending) return;

    const question = input.trim();
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);
    setError("");

    try {
      const response = await postChatQuestion({ analysisId, question });
      const answer = response.answer || response.message || "No response from the assistant.";
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: answer,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message.";
      setError(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-3xl border border-amber-100/20 bg-white/4 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <h2 className="text-lg font-semibold text-white">AI Chat</h2>

      <div className="mt-4 grid max-h-72 gap-3 overflow-auto pr-1">
        {messages.length === 0 ? (
          <p className="rounded-xl border border-white/12 bg-white/3 px-3 py-2 text-sm text-slate-200/80">
            Ask a question about the analyzed repository to start the conversation.
          </p>
        ) : null}

        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24 }}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl bg-teal-300/20 px-3 py-2 text-sm text-teal-50"
                : "mr-auto max-w-[85%] rounded-2xl bg-amber-300/10 px-3 py-2 text-sm text-amber-50"
            }
          >
            {message.text}
          </motion.div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="chat-input">
          Ask a question
        </label>
        <input
          id="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about architecture, risks, or refactoring opportunities..."
          className="h-11 flex-1 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white placeholder:text-slate-300/65 outline-none transition focus:border-teal-200/70 focus:ring-4 focus:ring-teal-200/20"
        />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={!input.trim() || sending}
          className="h-11 rounded-xl bg-linear-to-r from-teal-300 to-amber-300 px-5 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send"}
        </motion.button>
      </form>

      {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}
    </div>
  );
}
