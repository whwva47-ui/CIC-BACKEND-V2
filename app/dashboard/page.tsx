export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-black text-white flex">

      {/* SIDEBAR */}
      <div className="w-64 border-r border-[#222] p-6">

        <h1 className="text-2xl font-bold mb-10">
          CIC Dashboard
        </h1>

        <div className="space-y-4 text-gray-400">

          <div className="hover:text-white cursor-pointer">
            Home
          </div>

          <div className="hover:text-white cursor-pointer">
            Extensions
          </div>

          <div className="hover:text-white cursor-pointer">
            Install Guide
          </div>

          <div className="hover:text-white cursor-pointer">
            AI Tools
          </div>

          <div className="hover:text-white cursor-pointer">
            Referrals
          </div>

          <div className="hover:text-white cursor-pointer">
            Billing
          </div>

          <div className="hover:text-white cursor-pointer">
            Settings
          </div>

        </div>

      </div>

      {/* CONTENT */}
      <div className="flex-1 p-10">

        <h2 className="text-5xl font-bold mb-4">
          Welcome to CIC
        </h2>

        <p className="text-gray-400 text-lg">
          Operator workspace active
        </p>

      </div>

    </div>
  )
}
