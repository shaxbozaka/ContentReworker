import AppHeader from "@/components/AppHeader";
import ContentRepurposer from "@/components/ContentRepurposer";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800">
      <AppHeader />
      
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ContentRepurposer />
      </main>
      
      <Footer />
    </div>
  );
}
