import React, { useEffect } from 'react';
import { VoxideDocsSDK } from '../lib/voxide_sdk';

export default function DocsHome() {
  useEffect(() => {
    const voxide = new VoxideDocsSDK();
    console.log('[Voxide] Voice Navigation SDK Initialized on Documentation Site');
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', backgroundColor: '#0d1117', color: '#f0f6fc', minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid #30363d', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h1>EchoGuide Developer Documentation</h1>
        <p style={{ color: '#8b949e' }}>🎙️ Voxide Voice Navigation Active — Speak "search" or "read section" to navigate by voice.</p>
      </header>

      {/* Main Architecture Diagram Display */}
      <section id="architecture" style={{ background: '#161b22', padding: '1.5rem', borderRadius: '8px', border: '1px solid #30363d', marginBottom: '2rem' }}>
        <h2>System Architecture</h2>
        <img
          src="/assets/system_architecture_diagram.svg"
          alt="Voice Accessibility Assistant — System Architecture Diagram"
          style={{ width: '100%', maxHeight: '450px', objectFit: 'contain' }}
        />
      </section>

      <section id="components" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#161b22', padding: '1rem', borderRadius: '8px', border: '1px solid #30363d' }}>
          <h3>Mobile Client (Expo + Kotlin)</h3>
          <p style={{ fontSize: '0.9rem', color: '#8b949e' }}>Android AccessibilityService, VAD, Wake Word &amp; Native Bridge.</p>
        </div>
        <div style={{ background: '#161b22', padding: '1rem', borderRadius: '8px', border: '1px solid #30363d' }}>
          <h3>Backend API (Modular Monolith)</h3>
          <p style={{ fontSize: '0.9rem', color: '#8b949e' }}>Node.js / Express modular architecture with Addis AI integration.</p>
        </div>
        <div style={{ background: '#161b22', padding: '1rem', borderRadius: '8px', border: '1px solid #30363d' }}>
          <h3>Addis AI Voice Platform</h3>
          <p style={{ fontSize: '0.9rem', color: '#8b949e' }}>Amharic STT (3% WER), Addis-፩-አሌፍ LLM Planner, and Amharic TTS.</p>
        </div>
      </section>
    </div>
  );
}
