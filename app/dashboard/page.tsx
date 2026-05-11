import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

export default async function DashboardPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If no authenticated user, redirect to landing page
  if (!user) {
    redirect('/landing');
  }

  return (
    <div className="min-h-screen bg-black text-white p-10">
      <h1 className="text-4xl font-bold mb-4">
        CIC Dashboard
      </h1>

      <p className="text-gray-400 mb-10">
        Welcome {user.email}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
          <h2 className="text-2xl font-semibold mb-3">
            Prompt Folders
          </h2>

          <p className="text-gray-400">
            Organize operator prompts and workflows.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
          <h2 className="text-2xl font-semibold mb-3">
            Extension Downloads
          </h2>

          <p className="text-gray-400">
            Download Chrome and Firefox extensions.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
          <h2 className="text-2xl font-semibold mb-3">
            Account Status
          </h2>

          <p className="text-green-400">
            Verified Operator
          </p>
        </div>
      </div>
    </div>
  );
}
