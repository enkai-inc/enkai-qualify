import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Metis</h1>
          <p className="mt-2 text-gray-600">
            Transform market signals into buildable SaaS opportunities
          </p>
        </div>
        <SignIn
          appearance={{
            elements: {
              formButtonPrimary:
                'bg-blue-600 hover:bg-blue-700 text-sm normal-case',
              card: 'shadow-lg',
            },
          }}
        />
      </div>
    </div>
  );
}
