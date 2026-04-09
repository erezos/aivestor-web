export default function Refund() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-6 text-white/80 space-y-6">
      <h1 className="text-3xl font-black text-white">Refund Policy</h1>
      <p className="text-white/40 text-sm">Last updated: April 9, 2026</p>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">1. Digital Goods Policy</h2>
        <p>AIVestor sells digital tokens that are consumed to generate AI analysis reports. Due to the nature of digital goods, all token purchases are generally non-refundable once tokens have been used.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">2. Eligible Refunds</h2>
        <p>We will issue a full refund in the following cases:</p>
        <ul className="list-disc list-inside space-y-1 text-white/70">
          <li>You were charged but tokens were not credited to your account</li>
          <li>A technical error on our platform caused the purchase to fail</li>
          <li>Duplicate charges for the same transaction</li>
          <li>Request made within 14 days of purchase with unused tokens</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">3. Non-Refundable Cases</h2>
        <ul className="list-disc list-inside space-y-1 text-white/70">
          <li>Tokens that have already been used to generate reports</li>
          <li>Dissatisfaction with AI-generated analysis content</li>
          <li>Change of mind after tokens have been delivered</li>
          <li>Free daily tokens (these are complimentary and have no monetary value)</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">4. How to Request a Refund</h2>
        <p>To request a refund, contact us within 14 days of purchase at <a href="mailto:support@aivestor.online" className="text-violet-400 underline">support@aivestor.online</a> with:</p>
        <ul className="list-disc list-inside space-y-1 text-white/70">
          <li>Your account email address</li>
          <li>Transaction ID or purchase date</li>
          <li>Reason for the refund request</li>
        </ul>
        <p>We aim to process all refund requests within 5 business days.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">5. Mobile App Purchases</h2>
        <p>Purchases made through the iOS App Store or Google Play Store are subject to Apple's and Google's respective refund policies. Please contact Apple or Google directly for refunds on mobile purchases.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">6. Contact</h2>
        <p>Refund requests and questions: <a href="mailto:support@aivestor.online" className="text-violet-400 underline">support@aivestor.online</a></p>
      </section>
    </div>
  );
}