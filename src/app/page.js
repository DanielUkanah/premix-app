// "use client";
// import React, { useEffect, useState } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import { Loader2, LogOut, FileText, Truck } from "lucide-react";
// import { auth } from "@/lib/firebase";
// import { onAuthStateChanged, signOut } from "firebase/auth";

// const MAGENTA = "#C4237F";
// const PURPLE = "#3A2472";
// const PURPLE_DARK = "#281A52";
// const LAVENDER = "#F5F1FA";

// export default function DashboardHome() {
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const router = useRouter();

//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
//       if (!currentUser) {
//         router.push("/login");
//       } else {
//         setUser(currentUser);
//         setLoading(false);
//       }
//     });
//     return () => unsubscribe();
//   }, [router]);

//   if (loading) {
//     return (
//       <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: LAVENDER, color: PURPLE }}>
//         <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
//       </div>
//     );
//   }
"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, FileText, Truck, PieChart } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function DashboardHome() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push("/login");
      else setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBFD]">
        <Loader2 size={32} className="animate-spin text-[#3A2472]" />
      </div>
    );
  }

  const tools = [
    { title: "Invoice Generator", desc: "Create and download PDF proforma invoices.", icon: FileText, href: "/invoice" },
    // { title: "Expense Tracker", desc: "Track fleet fuel, maintenance, and reports.", icon: Truck, href: "/expenses" },
    { title: "Trucks and Finances", desc: "View Trucks performance and cost trends.", icon: PieChart, href: "/analysis" },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBFD] font-sans pb-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto mt-4">
        
        {/* Beautiful Custom Brand Diagonal Header */}
        <div className="brand-diagonal text-white px-6 py-5 rounded-t-xl shadow-sm flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <h1 className="font-medium text-[20px] tracking-tight m-0">
              Premix TrustConcrete — Dashboard
            </h1>
            <span className="text-[13px] text-white/75 font-normal">
              Dashboard Overview
            </span>
          </div>
          <button 
            onClick={() => signOut(auth)} 
            className="flex items-center gap-2 text-white/90 hover:text-white text-sm font-medium bg-transparent border-none cursor-pointer p-0 transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>

        {/* Tools Section */}
        <main className="mt-8">
          <h2 className="text-[#281A52] font-semibold text-xl mb-8">Welcome back! Select a tool:</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool) => (
              <Link key={tool.title} href={tool.href} className="group">
                <div className="bg-white p-8 rounded-2xl border border-[#E4DCF0] shadow-sm hover:shadow-lg hover:border-[#C4237F] transition-all duration-300 flex flex-col items-center text-center h-full">
                  <tool.icon size={40} className="text-[#C4237F] mb-5 group-hover:scale-110 transition-transform" />
                  <h3 className="text-[#3A2472] font-semibold text-lg mb-2">{tool.title}</h3>
                  <p className="text-[#8B7FA8] text-sm leading-relaxed">{tool.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

