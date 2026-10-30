import React, {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {useAuth} from '../../context/AuthContext';
import {BILLING_PLANS} from '../../../supabase/functions/_shared/billing-plans.js';

const fields='plan,status,trial_used,trial_end,period_end,cancel_at_period_end,updated_at';
export function SubscriptionPage({complimentary=false}){
  const {user}=useAuth();
  const [account,setAccount]=useState(null);
  const [ready,setReady]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const invoke=async body=>{
    const {data,error}=await supabase.functions.invoke('billing',{body});
    if(error){
      let message='Billing could not connect. Please try again.';
      try{message=(await error.context.json()).error || message;}catch{}
      throw new Error(message);
    }
    if(data?.error)throw new Error(data.error);
    return data;
  };
  const load=async()=>{
    const {data,error}=await supabase.from('billing_accounts').select(fields).eq('user_id',user.id).maybeSingle();
    if(error)throw new Error('Could not load your subscription. Please refresh before starting checkout.');
    setAccount(data);
  };
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const config=await invoke({action:'config'});
        if(!active)return;
        setReady(config.ready);
        if(config.ready)await invoke({action:'refresh'});
        if(active)await load();
      }catch(error){if(active)setError(error.message);}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[user.id]);
  const act=async(action,plan)=>{
    if(action==='checkout' && complimentary)return;
    setBusy(true);setError('');setMessage('');
    try{
      const data=await invoke({action,plan});
      if(data.url){
        const url=new URL(data.url);
        if(url.protocol!=='https:' || !['checkout.stripe.com','billing.stripe.com'].includes(url.hostname))throw new Error('Unexpected checkout link. Please contact support.');
        window.location.assign(url.href);
      }else{await load();setMessage('Subscription status updated.');}
    }catch(error){setError(error.message);}finally{setBusy(false);}
  };
  const subscribed=account && !['none','canceled','incomplete_expired'].includes(account.status);
  const formatDate=value=>value ? new Date(value).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}) : '';
  return <div className="subscription-page">
    <p className="eyebrow">NEWMUSIQ MEMBERSHIP</p><h1>Your subscription</h1>
    <p>{complimentary ? "Your account has complimentary access to all membership features. No subscription is required. Existing paid subscriptions remain active until you cancel them using Manage billing." : "Choose your plan. Prices are in USD and renew monthly. Cancel anytime through Manage billing."}</p>
    {loading && <p role="status">Loading subscription…</p>}
    {!complimentary && !loading && !ready && <p className="billing-notice">Live billing is currently unavailable. You cannot start a new subscription until billing setup is complete.</p>}
    {error && <p role="alert" className="auth-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {account?.plan && <section className="subscription-summary">
      <h2>{BILLING_PLANS[account.plan]?.name} subscription</h2>
      <p>Status: {account.status.replaceAll('_',' ')}</p>
      {account.status==='trialing' && <p>Free until {formatDate(account.trial_end)}. Then ${BILLING_PLANS[account.plan]?.cents/100}/month.</p>}
      {account.cancel_at_period_end ? <p>Cancellation scheduled. Subscription ends {formatDate(account.period_end || account.trial_end)}.</p>
        : account.status==='active' && account.period_end && <p>Next renewal: {formatDate(account.period_end)}.</p>}
      {['past_due','unpaid','incomplete'].includes(account.status) && <p>Your payment needs attention. Update your payment method in Manage billing.</p>}
      <button type="button" disabled={!ready || busy || loading} onClick={()=>act('portal')}>Manage billing / cancel</button>
    </section>}
    {!complimentary && <div className="subscription-plans">
      {Object.entries(BILLING_PLANS).map(([key,plan])=><section className={`subscription-plan ${account?.plan===key ? 'selected' : ''}`} key={key}>
        <h2>{plan.name}</h2><p className="subscription-price">${plan.cents/100}<small> / month</small></p>
        <p><strong>{plan.trialMonths===1 ? 'First month free' : 'First 3 months free'}</strong></p>
        <p>{key==='artist' ? 'For artists building their presence on NewMusiq. Artist-page editing also requires identity and ownership approval.' : 'For music listeners on NewMusiq.'}</p>
        <button type="button" disabled={!ready || busy || loading || Boolean(error) || Boolean(subscribed)} onClick={()=>act('checkout',key)}>
          {busy ? 'Please wait…' : account?.trial_used ? `Subscribe for $${plan.cents/100}/month` : `Start ${plan.trialMonths}-month free trial`}
        </button>
      </section>)}
    </div>}
    {!complimentary && <p className="subscription-terms">One introductory trial per account. A payment method is required at checkout. Your subscription automatically renews at the displayed monthly price after the trial unless canceled before it ends. Returning subscribers do not receive another trial.</p>}
    {ready && <button type="button" disabled={busy || loading} onClick={()=>act('refresh')}>Refresh subscription status</button>}
    {!ready && !loading && <button type="button" onClick={()=>window.location.reload()}>Check billing connection again</button>}
  </div>;
}
