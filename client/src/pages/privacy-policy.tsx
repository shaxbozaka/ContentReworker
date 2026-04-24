import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function PrivacyPolicy() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/">
          <Button variant="outline" className="mb-4">
            <i className="fas fa-arrow-left mr-2"></i> Back to Home
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-600">Last updated: April 5, 2025</p>
      </div>

      <div className="prose max-w-none">
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
          <p>
            This Privacy Policy describes how Content Repurposing Tool ("we", "us", or "our") collects, uses, and discloses your 
            information when you use our service (the "Service"). We are committed to protecting your privacy and ensuring the 
            security of your personal information.
          </p>
          <p>
            By using the Service, you agree to the collection and use of information in accordance with this policy. 
            This Privacy Policy has been created to comply with all applicable laws and regulations, including the General 
            Data Protection Regulation (GDPR).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
          <h3 className="text-xl font-medium mb-2">Personal Data</h3>
          <p>
            While using our Service, we may ask you to provide us with certain personally identifiable information that can be used
            to contact or identify you ("Personal Data"). Personally identifiable information may include, but is not limited to:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Email address</li>
            <li>First name and last name</li>
            <li>Cookies and Usage Data</li>
            <li>Social media profile information (when you connect platforms like LinkedIn, Google/YouTube)</li>
          </ul>

          <h3 className="text-xl font-medium mb-2">Google API Services User Data</h3>
          <p>
            When you choose to connect your Google account (for sign-in and/or YouTube
            personalization), Content Reworker requests only the scopes strictly required
            to deliver the feature you opted into:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li><code>openid</code>, <code>email</code>, <code>profile</code> — to identify you for sign-in.</li>
            <li><code>https://www.googleapis.com/auth/youtube.readonly</code> — read-only access to the subscriptions and liked-videos playlists on your YouTube account, so we can auto-populate the creators you already follow into your content-ideas feed and use your existing likes as personalization signals.</li>
          </ul>
          <p>
            <strong>How we use this data:</strong> Subscriptions are stored as entries in your
            private "tracked creators" list so the Service can ingest recent videos from
            those channels for you to browse. Liked-video identifiers are stored as
            feedback signals feeding the recommendation ranker; we do not display your
            liked videos to other users.
          </p>
          <p>
            <strong>How we do <em>not</em> use this data:</strong> We do not sell, rent, or
            share your Google/YouTube data with any third party. We do not use it to train,
            generalize, or improve any artificial intelligence or machine-learning model.
            We do not use it for advertising. Access is limited to the minimum personnel
            required to operate the Service.
          </p>
          <p>
            <strong>Retention and deletion:</strong> You can revoke our access at any time
            via your <a className="underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">Google Account security settings</a>{" "}
            or by removing the Content Reworker integration from within our Service. When
            you revoke access or delete your account, we delete the cached tracked-creator
            entries and interaction signals derived from your Google data within 30 days.
          </p>
          <p>
            Content Reworker's use of information received from Google APIs adheres to the{" "}
            <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>,
            including the Limited Use requirements.
          </p>

          <h3 className="text-xl font-medium mb-2">Content Data</h3>
          <p>
            We collect and process the content you submit to our service for repurposing across different platforms. This may include:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Blog posts, articles, or other text content you submit</li>
            <li>Metadata about your content</li>
            <li>Generated/repurposed content created by our service</li>
          </ul>

          <h3 className="text-xl font-medium mb-2">Usage Data</h3>
          <p>
            We may also collect information on how the Service is accessed and used ("Usage Data"). This Usage Data may include 
            information such as your computer's Internet Protocol address (e.g. IP address), browser type, browser version, 
            the pages of our Service that you visit, the time and date of your visit, the time spent on those pages, unique 
            device identifiers and other diagnostic data.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Use of Data</h2>
          <p>Content Repurposing Tool uses the collected data for various purposes:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>To provide and maintain the Service</li>
            <li>To notify you about changes to our Service</li>
            <li>To allow you to participate in interactive features of our Service when you choose to do so</li>
            <li>To provide customer care and support</li>
            <li>To provide analysis or valuable information so that we can improve the Service</li>
            <li>To monitor the usage of the Service</li>
            <li>To detect, prevent and address technical issues</li>
            <li>To process and transform your content for publishing on different platforms</li>
            <li>To integrate with third-party services that you explicitly connect (such as LinkedIn)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Transfer of Data</h2>
          <p>
            Your information, including Personal Data, may be transferred to — and maintained on — computers located outside of your 
            state, province, country or other governmental jurisdiction where the data protection laws may differ from those from your 
            jurisdiction.
          </p>
          <p>
            If you are located outside the United States and choose to provide information to us, please note that we transfer the 
            data, including Personal Data, to the United States and process it there.
          </p>
          <p>
            Your consent to this Privacy Policy followed by your submission of such information represents your agreement to that transfer.
          </p>
          <p>
            Content Repurposing Tool will take all steps reasonably necessary to ensure that your data is treated securely and in 
            accordance with this Privacy Policy and no transfer of your Personal Data will take place to an organization or a country 
            unless there are adequate controls in place including the security of your data and other personal information.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Disclosure of Data</h2>
          <h3 className="text-xl font-medium mb-2">Legal Requirements</h3>
          <p>
            Content Repurposing Tool may disclose your Personal Data in the good faith belief that such action is necessary to:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>To comply with a legal obligation</li>
            <li>To protect and defend the rights or property of Content Repurposing Tool</li>
            <li>To prevent or investigate possible wrongdoing in connection with the Service</li>
            <li>To protect the personal safety of users of the Service or the public</li>
            <li>To protect against legal liability</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Security of Data</h2>
          <p>
            The security of your data is important to us, but remember that no method of transmission over the Internet, 
            or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect 
            your Personal Data, we cannot guarantee its absolute security.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Social Media Integration</h2>
          <p>
            Our Service allows you to connect your social media accounts, such as LinkedIn, to enable direct posting from our platform.
            When you connect these services, we follow the authorization protocols established by these platforms (OAuth), and we only
            access the data and perform the actions that you have explicitly granted us permission to do.
          </p>
          <p>
            We do not store your social media passwords. Instead, we store secure tokens that allow us to publish content on your
            behalf. You can revoke these permissions at any time through our application or directly through the social media platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Your Data Protection Rights Under GDPR</h2>
          <p>
            If you are a resident of the European Economic Area (EEA), you have certain data protection rights. Content Repurposing Tool 
            aims to take reasonable steps to allow you to correct, amend, delete, or limit the use of your Personal Data.
          </p>
          <p>If you wish to be informed what Personal Data we hold about you and if you want it to be removed from our systems, please contact us.</p>
          <p>In certain circumstances, you have the following data protection rights:</p>
          <ul className="list-disc pl-6 mb-4">
            <li><strong>The right to access, update or to delete</strong> the information we have on you.</li>
            <li><strong>The right of rectification.</strong> You have the right to have your information rectified if that information is inaccurate or incomplete.</li>
            <li><strong>The right to object.</strong> You have the right to object to our processing of your Personal Data.</li>
            <li><strong>The right of restriction.</strong> You have the right to request that we restrict the processing of your personal information.</li>
            <li><strong>The right to data portability.</strong> You have the right to be provided with a copy of the information we have on you in a structured, machine-readable and commonly used format.</li>
            <li><strong>The right to withdraw consent.</strong> You also have the right to withdraw your consent at any time where Content Repurposing Tool relied on your consent to process your personal information.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>By email: privacy@contentrepurposing.example.com</li>
            <li>By visiting the contact page on our website</li>
          </ul>
        </section>
      </div>
    </div>
  );
}