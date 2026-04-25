import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-600">Last updated: April 5, 2025</p>
      </div>

      <div className="prose max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p>
            Welcome to Content Repurposing Tool. These Terms of Service ("Terms") govern your use of our web-based content repurposing 
            service (the "Service") operated by Content Repurposing Tool ("us", "we", or "our").
          </p>
          <p>
            By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, 
            you may not access the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
          <p>
            Content Repurposing Tool provides an AI-powered platform that helps users transform their long-form content 
            into optimized formats for multiple social media platforms and other digital channels. The Service may include 
            features such as:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Content transformation and adaptation</li>
            <li>Multi-platform content optimization</li>
            <li>Social media publishing</li>
            <li>Content storage and management</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
          <p>
            When you create an account with us, you must provide information that is accurate, complete, and current at all times. 
            Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
          </p>
          <p>
            You are responsible for safeguarding the password that you use to access the Service and for any activities or actions 
            under your password. You agree not to disclose your password to any third party. You must notify us immediately upon 
            becoming aware of any breach of security or unauthorized use of your account.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. User Content</h2>
          <p>
            Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, 
            or other material ("User Content"). You are responsible for the User Content that you post on or through the Service, 
            including its legality, reliability, and appropriateness.
          </p>
          <p>
            By posting User Content on or through the Service, you represent and warrant that:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>You own or have the right to use and distribute such content</li>
            <li>The content does not violate the privacy rights, publicity rights, copyright, contractual rights, or any other rights of any person or entity</li>
            <li>The content does not contain material that is defamatory, obscene, offensive, hateful, or otherwise objectionable</li>
          </ul>
          <p>
            We reserve the right to terminate the account of any user found to be in violation of these terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Intellectual Property</h2>
          <p>
            The Service and its original content (excluding User Content), features, and functionality are and will remain the 
            exclusive property of Content Repurposing Tool and its licensors. The Service is protected by copyright, trademark, 
            and other laws of both the United States and foreign countries. Our trademarks and trade dress may not be used 
            in connection with any product or service without the prior written consent of Content Repurposing Tool.
          </p>
          <p>
            You retain all your ownership rights to your User Content. However, by uploading User Content to the Service, you grant 
            us a limited license to use, modify, publicly perform, publicly display, reproduce, and distribute such User Content 
            solely for the purpose of providing the Service to you. This license ends when you delete your User Content or your account.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Third-Party Services</h2>
          <p>
            Our Service integrates with third-party services, including but not limited to social media platforms like LinkedIn, 
            Twitter, and others. When you connect such services to our platform, you agree to comply with their respective terms 
            of service. We are not responsible for the content, policies, or practices of any third-party services.
          </p>
          <p>
            When you publish content to third-party platforms through our Service, you remain solely responsible for ensuring that 
            such content complies with the terms, policies, and guidelines of those platforms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>
          <p>
            In no event shall Content Repurposing Tool, nor its directors, employees, partners, agents, suppliers, or affiliates, 
            be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, 
            loss of profits, data, use, goodwill, or other intangible losses, resulting from:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Your access to or use of or inability to access or use the Service;</li>
            <li>Any conduct or content of any third party on the Service;</li>
            <li>Any content obtained from the Service; and</li>
            <li>Unauthorized access, use or alteration of your transmissions or content.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Disclaimer</h2>
          <p>
            Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis. 
            The Service is provided without warranties of any kind, whether express or implied, including, but not limited to, 
            implied warranties of merchantability, fitness for a particular purpose, non-infringement or course of performance.
          </p>
          <p>
            Content Repurposing Tool, its subsidiaries, affiliates, and its licensors do not warrant that:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>The Service will function uninterrupted, secure or available at any particular time or location;</li>
            <li>Any errors or defects will be corrected;</li>
            <li>The Service is free of viruses or other harmful components; or</li>
            <li>The results of using the Service will meet your requirements.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Changes to Terms</h2>
          <p>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, 
            we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change 
            will be determined at our sole discretion.
          </p>
          <p>
            By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised 
            terms. If you do not agree to the new terms, please stop using the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Contact Us</h2>
          <p>If you have any questions about these Terms, please contact us:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>By email: terms@contentrepurposing.example.com</li>
            <li>By visiting the contact page on our website</li>
          </ul>
        </section>
      </div>
    </div>
  );
}