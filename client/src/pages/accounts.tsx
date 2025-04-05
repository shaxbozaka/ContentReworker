import UserManagement from "@/components/UserManagement";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";

export default function AccountsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      
      <main className="flex-1 py-10">
        <div className="container px-4 mx-auto">
          <div className="max-w-screen-lg mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">
              LinkedIn Account Management
            </h1>
            
            <UserManagement />
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}