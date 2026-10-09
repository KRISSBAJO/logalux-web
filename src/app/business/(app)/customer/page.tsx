import Link from "next/link";
import {getMe} from "@/lib/merchant-api";
import {useAsCustomer} from "../actions";
export default async function CustomerProfile({searchParams}:{searchParams:Promise<{err?:string}>}) {
 const me=await getMe(); const sp=await searchParams;
 return <div className="main p-8"><h1 className="serif text-3xl">Your personal customer profile</h1><p className="my-4">Use {me?.merchant.name} and {me?.merchant.email} to book your own visits and shop. Your business and personal purchases stay separate. No new password is needed when entering through your merchant login.</p>{sp.err && <p role="alert" className="my-4 text-wine">{sp.err}</p>}<form action={useAsCustomer}><button className="btn btn-ink">Use LogaLuxe as a customer</button></form><p className="mt-5">Already have a customer account? <Link className="text-wine underline" href="/signin?next=/business/customer">Sign in once to link it</Link>.</p></div>;
}
