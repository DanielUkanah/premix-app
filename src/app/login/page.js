"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

// Brand Tokens
const MAGENTA = "#C4237F";
const MAGENTA_DARK = "#9B1B65";
const PURPLE = "#3A2472";
const PURPLE_DARK = "#281A52";
const LAVENDER = "#F5F1FA";
const LINE = "#E4DCF0";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter(); // Next.js router for redirection

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // Secretly append the domain so Firebase thinks it's an email
      const formattedEmail = `${username.trim().toLowerCase()}@premix.com`;
      await signInWithEmailAndPassword(auth, formattedEmail, password);
      
      // On success, send them to the Dashboard (Home page)
      router.push("/"); 
    } catch (err) {
      setError("Invalid username or password. Access denied.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: LAVENDER, fontFamily: "Inter, sans-serif", padding: 20 }}>
      <div style={{ background: "#fff", padding: "40px 30px", borderRadius: 16, width: "100%", maxWidth: 400, boxShadow: "0 10px 25px rgba(58,36,114,0.08)", border: `1px solid ${LINE}` }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20, color: MAGENTA }}>
          <Lock size={48} />
        </div>
        <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, color: PURPLE_DARK, textAlign: "center", marginBottom: 8 }}>Premix Secure Portal</h1>
        <p style={{ fontSize: 13, color: "#8B7FA8", textAlign: "center", marginBottom: 24 }}>Enter your username and password to access the system.</p>
        
        {error && <div style={{ background: "#FDF0F7", color: MAGENTA_DARK, padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 500, textAlign: "center", border: `1px solid ${MAGENTA}` }}>{error}</div>}
        
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: PURPLE, marginBottom: 6 }}>Username</div>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ width: "100%", padding: "12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 14, outline: "none", boxSizing: "border-box" }} placeholder="e.g. admin" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: PURPLE, marginBottom: 6 }}>Password</div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%", padding: "12px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 14, outline: "none", boxSizing: "border-box" }} placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} style={{ width: "100%", background: `linear-gradient(120deg, ${MAGENTA} 0%, ${PURPLE} 100%)`, color: "#fff", border: "none", borderRadius: 8, padding: "14px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 8 }}>
            {loading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}