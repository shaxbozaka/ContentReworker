import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function RefundPolicy() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2">Refund Policy</h1>
        <p className="text-gray-600">Last updated: April 23, 2026</p>
      </div>

      <div className="prose max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Overview</h2>
          <p>
            This Refund Policy describes when and how you can request a refund for purchases made on Content Reworker
            ("we", "us", "our"). By subscribing to a paid plan you agree to the terms below. Our payments are processed
            by Paddle, who acts as the merchant of record for all transactions.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. 14-Day Money-Back Guarantee</h2>
          <p>
            If you are not satisfied with a paid subscription, you may request a full refund within <strong>14 days</strong>
            of your initial purchase. This applies to your first purchase of a Pro monthly or Pro annual plan.
          </p>
          <p>
            Renewals (monthly or annual) are not covered by the money-back guarantee. Cancel before a renewal date to
            avoid being billed for the next cycle.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. How to Request a Refund</h2>
          <p>Email <a href="mailto:support@aicontentrepurposer.com">support@aicontentrepurposer.com</a> with:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>The email address on your account</li>
            <li>The transaction ID or date of purchase</li>
            <li>A short note on the reason (optional but appreciated)</li>
          </ul>
          <p>
            We will acknowledge within 2 business days and, if eligible, process the refund through Paddle. Funds
            typically return to the original payment method within 5–10 business days depending on your bank.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Cancellations</h2>
          <p>
            You can cancel your subscription at any time from your account billing page. Cancellation stops future
            renewals — your plan remains active until the end of the current billing period, and no refund is issued
            for the remaining time unless you qualify under Section 2.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Ineligible Cases</h2>
          <p>Refunds will not be granted when:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>The request is made more than 14 days after the initial purchase</li>
            <li>The request is for a renewal charge rather than an initial purchase</li>
            <li>The account has been suspended or terminated for violating our Terms of Service</li>
            <li>There is evidence of abuse of the refund policy (e.g., repeat purchase-and-refund cycles)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Chargebacks</h2>
          <p>
            If you believe a charge is incorrect, please contact us first — most issues can be resolved faster by email
            than through a chargeback. Filing a chargeback before contacting us may result in account suspension while
            the dispute is investigated.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Contact</h2>
          <p>
            Questions about this policy? Email <a href="mailto:support@aicontentrepurposer.com">support@aicontentrepurposer.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
