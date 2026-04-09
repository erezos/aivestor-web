export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] py-10 px-6">
    <div className="max-w-3xl mx-auto text-white/80 space-y-6">
      <h1 className="text-3xl font-black text-white">Privacy Policy</h1>
      <p className="text-white/40 text-sm">Last updated: April 9, 2026</p>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">1. Information We Collect</h2>
        <p>We collect information you provide when creating an account (email address), usage data (assets searched, reports generated), device information, and payment transaction data processed by our payment providers.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">2. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul className="list-disc list-inside space-y-1 text-white/70">
          <li>Provide and improve the AIVestor service</li>
          <li>Process token purchases and maintain wallet balances</li>
          <li>Send service-related emails (if subscribed)</li>
          <li>Analyze usage patterns to improve AI analysis quality</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">3. Data Sharing</h2>
        <p>We do not sell your personal data. We may share data with:</p>
        <ul className="list-disc list-inside space-y-1 text-white/70">
          <li>Payment processors (Paddle) to handle transactions</li>
          <li>AI service providers to generate analysis reports</li>
          <li>Analytics providers to improve the service</li>
          <li>Law enforcement when required by law</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">4. Data Security</h2>
        <p>We implement industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">5. Cookies</h2>
        <p>We use essential cookies to maintain your session and preferences. We do not use advertising cookies or sell cookie data to third parties.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">6. Your Rights</h2>
        <p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at <a href="mailto:support@aivestor.online" className="text-violet-400 underline">support@aivestor.online</a>.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">7. Data Retention</h2>
        <p>We retain your data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">8. Contact</h2>
        <p>For privacy-related inquiries: <a href="mailto:support@aivestor.online" className="text-violet-400 underline">support@aivestor.online</a></p>
      </section>
    </div>
    </div>
  );
}