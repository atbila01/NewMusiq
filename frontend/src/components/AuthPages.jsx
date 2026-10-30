import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { SignIn, SignUp } from "@clerk/react"
import AuthLayout from "./AuthLayout"
import SignInForm from "./auth/SignInForm"
import PlanPicker from "./PlanPicker"
import { getSavedPlan, savePlan } from "@/lib/profile"

function SignInBody() {
  const { pathname, search } = useLocation()
  const sub = pathname.replace(/\/+$/, "")
  if (sub === "/sign-in" && !search.includes("__clerk_ticket")) return <SignInForm />
  if (sub.startsWith("/sign-in/reset")) return <SignIn routing="path" path="/sign-in/reset" signUpUrl="/sign-up" />
  return <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
}

export function SignInPage() {
  return (
    <AuthLayout mode="login" footer={
      <p className="create-account" data-testid="create-account-prompt">
        New to NewMusiq? <Link to="/sign-up" data-testid="create-account-link">Create an Account</Link>
      </p>
    }>
      <SignInBody />
    </AuthLayout>
  )
}

export function SignUpPage() {
  const [plan, setPlan] = useState(getSavedPlan)
  const choose = (p) => { setPlan(p); savePlan(p) }
  return (
    <AuthLayout mode="create" title="Create Your Account"
      aside={<PlanPicker value={plan} onChange={choose} />}
      footer={<p className="setup-steps" data-testid="signup-steps">Step 1 of 3 · Next: username &amp; location, then payment</p>}>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </AuthLayout>
  )
}
