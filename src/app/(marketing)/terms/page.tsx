export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-blue-200/70 text-sm mt-3">Last updated: March 1, 2024</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16 prose prose-slate">
        <p className="text-slate-600 leading-relaxed">
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of D2D Blitz (&quot;the Platform&quot;), operated by D2D Blitz Inc. By accessing or using the Platform, you agree to be bound by these Terms.
        </p>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Acceptance of Terms
        </h2>
        <p className="text-slate-600 leading-relaxed">
          By creating an account or using any part of the Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree, you may not use the Platform.
        </p>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Account Terms
        </h2>
        <ul className="list-disc pl-6 text-slate-600 space-y-2 text-sm">
          <li>You must be at least 18 years old to use the Platform</li>
          <li>You are responsible for maintaining the security of your account credentials</li>
          <li>You must provide accurate and complete information when creating your account</li>
          <li>You may not share your account or allow others to access it</li>
          <li>You must notify us immediately of any unauthorized access to your account</li>
        </ul>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Use License
        </h2>
        <p className="text-slate-600 leading-relaxed">
          We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Platform for its intended purpose of managing door-to-door sales operations. This license is subject to these Terms and does not include the right to modify, distribute, or create derivative works from the Platform.
        </p>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Acceptable Conduct
        </h2>
        <p className="text-slate-600 leading-relaxed mb-3">You agree not to:</p>
        <ul className="list-disc pl-6 text-slate-600 space-y-2 text-sm">
          <li>Use the Platform for any unlawful purpose or in violation of any regulations</li>
          <li>Submit false or misleading activity data, sales records, or other information</li>
          <li>Attempt to gain unauthorized access to other user accounts or platform systems</li>
          <li>Interfere with or disrupt the Platform&apos;s infrastructure or services</li>
          <li>Use automated tools to access the Platform without our written consent</li>
        </ul>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Commission and Payments
        </h2>
        <p className="text-slate-600 leading-relaxed">
          Commission calculations displayed on the Platform are based on the configurations set by your market owner or administrator. While we strive for accuracy, final payout amounts are subject to install verification and may be adjusted for deductions, chargebacks, or corrections. The Platform facilitates commission tracking but does not constitute a guarantee of payment.
        </p>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Termination
        </h2>
        <p className="text-slate-600 leading-relaxed">
          We may suspend or terminate your access to the Platform at any time, with or without cause, and with or without notice. Upon termination, your right to use the Platform ceases immediately. We may retain your data as required by law or legitimate business purposes.
        </p>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Limitation of Liability
        </h2>
        <p className="text-slate-600 leading-relaxed">
          To the maximum extent permitted by law, D2D Blitz shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, or goodwill.
        </p>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Governing Law
        </h2>
        <p className="text-slate-600 leading-relaxed">
          These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law principles.
        </p>

        <h2 className="text-xl font-bold text-slate-900 mt-10 mb-4" style={{ fontFamily: "var(--font-heading)" }}>
          Contact Us
        </h2>
        <p className="text-slate-600 leading-relaxed">
          If you have questions about these Terms, please contact us at{" "}
          <a href="mailto:legal@d2dblitz.com" className="text-blue-600 hover:text-blue-700 underline">
            legal@d2dblitz.com
          </a>.
        </p>
      </div>
    </div>
  );
}
