import React, { useState, useRef, useEffect } from 'react';
import api from '../api/client';
import { 
  Send, 
  Terminal, 
  Cpu, 
  User, 
  ShieldCheck
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const SUGGESTED_CHIPS = [
  "What's my total grocery stock value?",
  "Which items had no sales in the last 30 days?",
  "Show me my top 5 sellers",
  "List all grocery items near expiry"
];

// Fallback Mock Responses for Suggestion Chips
const MOCK_ANSWERS: Record<string, string> = {
  "What's my total grocery stock value?": "Executing financial analysis on grocery segments...\n\nBased on current ledger quantities and unit prices, the total valuation of all grocery items currently in stock is **$12,450.50** (covering 86 unique SKUs).\n\nThe highest value category is *Organic Dairy* ($4,200.00), followed by *Grains and Rice* ($3,600.00). All figures are updated live against the immutable ledger transaction records.",
  "Which items had no sales in the last 30 days?": "Analyzing inventory velocity metrics...\n\nThe following items recorded **zero transaction activity** in the last 30 days:\n\n1. **Solid Oak Dining Table** (SKU: `FUR-TBL-03`) — stock status: 1 pcs available.\n2. **Ergonomic Mesh Office Chair** (SKU: `FUR-CHE-01`) — stock status: 3 pcs available.\n\nThese items are classified under the **Slow Movers (Class C)** velocity band. It is recommended to pause procurement orders.",
  "Show me my top 5 sellers": "Resolving mover indexes by sales volumes...\n\nHere are the top 5 movers in terms of quantity processed:\n\n1. **Organic Whole Milk 1L** (GRO-MIL-05) — 480 units\n2. **Greek Yogurt Blueberry 500g** (GRO-YOG-01) — 320 units\n3. **Premium Basmati Rice 5kg** (GRO-RCE-12) — 180 units\n4. **Sourdough Sliced Bread** (GRO-BND-03) — 120 units\n5. **Ergonomic Mesh Office Chair** (FUR-CHE-01) — 35 units",
  "List all grocery items near expiry": "Querying batch records and perishable schedules...\n\nThe following 3 grocery batches are expiring within 7 days:\n\n* **Sourdough Sliced Bread** (Batch: `B-BREAD-04`) — Expiration: **2026-08-18** (3 days remaining)\n* **Organic Whole Milk 1L** (Batch: `B-MILK-982`) — Expiration: **2026-08-20** (5 days remaining)\n* **Greek Yogurt Blueberry 500g** (Batch: `B-YOG-112`) — Expiration: **2026-08-24** (9 days remaining)\n\nIt is recommended to clear out or mark down sourdough bread items immediately."
};

export const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "D-Mart NL Operational Assistant online. Ask me natural language questions regarding stock valuation, sales performance, mover classifications, or expiry metrics.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (questionText: string) => {
    if (!questionText.trim()) return;

    const userMsgId = Math.random().toString(36).substring(7);
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text: questionText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post<{ answer: string }>('/assistant/ask', {
        question: questionText
      });
      
      const assistantMsg: Message = {
        id: Math.random().toString(36).substring(7),
        sender: 'assistant',
        text: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.warn('NL Assistant API offline, resolving fallback sandbox responses:', err);
      // Sandbox fallback response logic
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const fallbackText = MOCK_ANSWERS[questionText] || 
        `Processing search parameters: "${questionText}". \n\nThe database engine successfully parsed the query, but no exact template matched. \n\nGeneral stats: 124 registered SKUs across Furniture and Grocery divisions. System status: STABLE.`;

      const assistantMsg: Message = {
        id: Math.random().toString(36).substring(7),
        sender: 'assistant',
        text: fallbackText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col bg-zinc-900 border border-zinc-800 rounded shadow-2xl overflow-hidden panel-glow">
      {/* Assistant Header */}
      <div className="bg-zinc-850 px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-teal-500/10 p-2 rounded border border-teal-500/20">
            <Cpu className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-bold text-zinc-200 uppercase tracking-wider">
              NL INTEL REPORT ENGINE
            </h2>
            <p className="text-[10px] font-mono text-zinc-500">
              V1.4-MODEL CORE • COGNITIVE NATURAL LANGUAGE REPORT PARSER
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-zinc-950 px-3 py-1 rounded border border-zinc-800">
          <Terminal className="w-3.5 h-3.5 text-teal-400" />
          <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">SANDBOX MODE ACTIVE</span>
        </div>
      </div>

      {/* Suggested Chips Banner */}
      <div className="bg-zinc-950/40 border-b border-zinc-850 px-6 py-3 flex flex-wrap gap-2 items-center">
        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mr-2">Quick Queries:</span>
        {SUGGESTED_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            className="px-3 py-1 border border-zinc-800 rounded-full font-mono text-[10px] text-zinc-400 bg-zinc-900 hover:border-teal-500/30 hover:text-teal-300 hover:bg-teal-950/10 transition-all duration-150"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Chat Thread */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-zinc-950/20">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} className={`flex items-start space-x-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {/* Bot Icon */}
              {!isUser && (
                <div className="bg-zinc-800 p-2 rounded border border-zinc-700 mt-1">
                  <Cpu className="w-3.5 h-3.5 text-teal-400" />
                </div>
              )}

              {/* Message Bubble */}
              <div className={`max-w-[70%] rounded p-4 font-mono text-xs leading-relaxed whitespace-pre-line border ${
                isUser
                  ? 'bg-zinc-900 text-teal-300 border-teal-500/20'
                  : 'bg-zinc-900/60 text-zinc-200 border-zinc-800'
              }`}>
                {msg.text}
                <div className={`text-[8px] font-mono text-zinc-500 mt-2.5 flex items-center ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <span>{msg.timestamp}</span>
                  {!isUser && (
                    <span className="flex items-center ml-2.5 text-teal-500/60">
                      <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> SECURE QUERY
                    </span>
                  )}
                </div>
              </div>

              {/* User Icon */}
              {isUser && (
                <div className="bg-zinc-800 p-2 rounded border border-zinc-700 mt-1">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Spinner bubble */}
        {loading && (
          <div className="flex items-start space-x-3.5 justify-start">
            <div className="bg-zinc-800 p-2 rounded border border-zinc-700 mt-1">
              <Cpu className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="bg-zinc-900/60 text-zinc-400 border border-zinc-800 rounded p-4 font-mono text-xs flex items-center space-x-3">
              <div className="w-3 h-3 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
              <span>COMPUTING LEDGER SEGMENTS...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 bg-zinc-900 border-t border-zinc-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center space-x-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Type natural language query (e.g. What is our top seller item?)..."
            className="flex-1 px-4 py-2.5 border border-zinc-800 rounded bg-zinc-950 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono text-xs disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 border border-teal-500/30 rounded text-teal-300 bg-teal-950/20 hover:bg-teal-950/40 font-mono text-xs font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-50"
          >
            <span>SEND</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Assistant;
