import { useState, useRef, useEffect } from "react";
import {
  handleGoogleLogin,
  handleEmailLogin,
  handleEmailSignUp,
  handlePhoneSignIn,
  confirmPhoneCode,
} from "../services/auth";

const PROVIDERS = {
  SELECT: "select",
  EMAIL: "email",
  PHONE: "phone",
};

export function LoginPage() {
  const [provider, setProvider] = useState(PROVIDERS.SELECT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Email state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  // Phone state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [codeSent, setCodeSent] = useState(false);

  const recaptchaRef = useRef(null);

  useEffect(() => {
    setError("");
  }, [provider]);

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      const user = await handleGoogleLogin();
      if (!user) {
        // User closed popup, do nothing
      }
    } catch (err) {
      setError(err.message || "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      if (isSignUp) {
        await handleEmailSignUp(email.trim(), password);
      } else {
        await handleEmailLogin(email.trim(), password);
      }
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Try signing in instead.");
      } else if (err.code === "auth/user-not-found") {
        setError("No account found with this email. Try signing up.");
      } else if (err.code === "auth/wrong-password") {
        setError("Incorrect password.");
      } else if (err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else {
        setError(err.message || "Authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSendCode = async () => {
    if (!phoneNumber.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await handlePhoneSignIn(phoneNumber.trim(), "recaptcha-container");
      setConfirmationResult(result);
      setCodeSent(true);
    } catch (err) {
      setError(err.message || "Failed to send SMS code.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneConfirmCode = async () => {
    if (!phoneCode.trim() || !confirmationResult) return;
    setLoading(true);
    setError("");
    try {
      await confirmPhoneCode(confirmationResult, phoneCode.trim());
    } catch (err) {
      setError(err.message || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  const resetPhone = () => {
    setPhoneNumber("");
    setPhoneCode("");
    setConfirmationResult(null);
    setCodeSent(false);
  };

  return (
    <main className="phone-shell flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-['Sora'] text-3xl font-bold text-[#163d31]">Calories Coach</h1>
          <p className="mt-1 text-sm text-[#4c695b]">Sign in to sync your data to the cloud</p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {provider === PROVIDERS.SELECT && (
          <div className="space-y-3">
            <button
              className="btn-primary flex w-full items-center justify-center gap-3"
              onClick={handleGoogle}
              disabled={loading}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {loading ? "Signing in..." : "Continue with Google"}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#d9e3d8]" />
              <span className="text-sm text-[#5c776a]">or</span>
              <div className="h-px flex-1 bg-[#d9e3d8]" />
            </div>

            <button
              className="btn-muted w-full"
              onClick={() => setProvider(PROVIDERS.EMAIL)}
            >
              Continue with Email
            </button>

            <button
              className="btn-muted w-full"
              onClick={() => setProvider(PROVIDERS.PHONE)}
            >
              Continue with Phone
            </button>
          </div>
        )}

        {provider === PROVIDERS.EMAIL && (
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <label className="text-sm text-[#3d5f51]">
              Email
              <input
                type="email"
                className="input mt-1"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="text-sm text-[#3d5f51]">
              Password
              <input
                type="password"
                className="input mt-1"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
            </button>

            <button
              type="button"
              className="w-full text-sm text-[#2d7a5c] font-semibold"
              onClick={() => {
                setIsSignUp((prev) => !prev);
                setError("");
              }}
            >
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>

            <button
              type="button"
              className="btn-muted w-full"
              onClick={() => setProvider(PROVIDERS.SELECT)}
            >
              Back
            </button>
          </form>
        )}

        {provider === PROVIDERS.PHONE && (
          <div className="space-y-3">
            {!codeSent ? (
              <>
                <label className="text-sm text-[#3d5f51]">
                  Phone Number
                  <input
                    type="tel"
                    className="input mt-1"
                    placeholder="+1234567890"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </label>
                <div id="recaptcha-container" ref={recaptchaRef} />
                <button
                  className="btn-primary w-full"
                  onClick={handlePhoneSendCode}
                  disabled={loading || !phoneNumber.trim()}
                >
                  {loading ? "Sending..." : "Send Verification Code"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-[#4c695b]">
                  A verification code was sent to {phoneNumber}. Enter it below.
                </p>
                <label className="text-sm text-[#3d5f51]">
                  Verification Code
                  <input
                    type="text"
                    className="input mt-1"
                    placeholder="000000"
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    required
                  />
                </label>
                <button
                  className="btn-primary w-full"
                  onClick={handlePhoneConfirmCode}
                  disabled={loading || !phoneCode.trim()}
                >
                  {loading ? "Verifying..." : "Confirm Code"}
                </button>
                <button
                  type="button"
                  className="w-full text-sm text-[#2d7a5c] font-semibold"
                  onClick={resetPhone}
                >
                  Change phone number
                </button>
              </>
            )}

            <button
              type="button"
              className="btn-muted w-full"
              onClick={() => {
                resetPhone();
                setProvider(PROVIDERS.SELECT);
              }}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </main>
  );
}