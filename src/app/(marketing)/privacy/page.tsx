export default function PrivacyPage() {
  return (
    <div className="pt-24">
      <div
        className="py-16 px-6 text-center"
        style={{
          background: "linear-gradient(145deg, #0F172A 0%, #1E3A8A 55%, #1E40AF 100%)",
        }}
      >
        <h1
          className="text-white text-3xl lg:text-4xl font-bold"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Privacy Policy
        </h1>
        <p className="text-blue-200/70 text-sm mt-3">Last updated: March 1, 2024</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-slate">
        <p className="text-slate-600 leading-relaxed">
          D2D Blitz (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform and mobile application.
        </p>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Information We Collect
        </h2>
        <p className="text-slate-600 leading-relaxed mb-3">We collect information you provide directly, including:</p>
        <ul className="list-disc pl-6 text-slate-600 space-y-2 text-sm">
          <li>Account information (name, email address, phone number, role)</li>
          <li>Profile information (photo, market assignment, team affiliation)</li>
          <li>Activity data (doors knocked, conversations, sales, go-backs)</li>
          <li>Location data (when using the mobile app with your permission)</li>
          <li>Commission and payment information</li>
        </ul>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          How We Use Your Information
        </h2>
        <ul className="list-disc pl-6 text-slate-600 space-y-2 text-sm">
          <li>To provide and maintain our platform services</li>
          <li>To calculate and process commission payouts</li>
          <li>To generate leaderboards and performance analytics</li>
          <li>To facilitate blitz campaign management and staffing</li>
          <li>To send important notifications about your account and activity</li>
          <li>To improve our platform and develop new features</li>
        </ul>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Data Sharing
        </h2>
        <p className="text-slate-600 leading-relaxed">
          We do not sell your personal information. We may share your data with:
        </p>
        <ul className="list-disc pl-6 text-slate-600 space-y-2 text-sm mt-3">
          <li>Your field managers and market owners (performance data relevant to their team)</li>
          <li>Payment processors (for commission payouts)</li>
          <li>Service providers who assist in platform operations</li>
          <li>Law enforcement when required by applicable law</li>
        </ul>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Data Security
        </h2>
        <p className="text-slate-600 leading-relaxed">
          We implement industry-standard security measures including 256-bit encryption for data in transit and at rest, regular security audits, and SOC 2 compliance standards. Access to personal data is restricted to authorized personnel only.
        </p>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Your Rights
        </h2>
        <p className="text-slate-600 leading-relaxed">You have the right to:</p>
        <ul className="list-disc pl-6 text-slate-600 space-y-2 text-sm mt-3">
          <li>Access and receive a copy of your personal data</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your account and associated data</li>
          <li>Opt out of non-essential communications</li>
          <li>Withdraw consent for location tracking at any time</li>
        </ul>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Contact Us
        </h2>
        <p className="text-slate-600 leading-relaxed">
          If you have questions about this Privacy Policy or your personal data, please contact us at{" "}
          <a href="mailto:privacy@d2dblitz.com" className="text-blue-600 hover:text-blue-700 underline">
            privacy@d2dblitz.com
          </a>.
        </p>
      </div>
    </div>
  );
}
