import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Button, DataState, FormField, Modal, PageTitle, Panel, Status } from '../../components/common';
import { formatINR } from '../../utils/currency';
import { createWithdrawal, getTransactions, getWallet } from '../../services/walletService';
import { createRazorpayOrder, getActiveManualUpiMethod, loadRazorpayCheckout, submitManualDeposit, verifyRazorpayPayment } from '../../services/paymentService';
import { subscribeToWalletUpdates } from '../../services/socketService';
import { GameImage } from '../../components/games/GameImage'
import { TransactionRows } from '../../components/wallet/TransactionList'
import { RAZORPAY_KEY_ID } from '../../config/api'
import { useAuth } from '../../hooks/useAuth'

export function WalletPage({notify}) {
  const { user } = useAuth()
  const [filter,setFilter]=useState('All')
  const [showAddMoney,setShowAddMoney]=useState(false)
  const [showWithdrawal,setShowWithdrawal]=useState(false)
  const [withdrawalBusy,setWithdrawalBusy]=useState(false)
  const [withdrawalError,setWithdrawalError]=useState('')
  const [withdrawalResult,setWithdrawalResult]=useState(null)
  const [paymentBusy,setPaymentBusy]=useState(false)
  const [razorpayBusy,setRazorpayBusy]=useState(false)
  const [razorpayError,setRazorpayError]=useState('')
  const [verificationData,setVerificationData]=useState(null)
  const razorpayLock=useRef(false)
  const verificationLock=useRef(false)
  const checkoutPaymentReceived=useRef(false)
  const orderRequestId=useRef(null)
  const [paymentError,setPaymentError]=useState('')
  const [manualMethod,setManualMethod]=useState(null)
  const [manualMethodLoading,setManualMethodLoading]=useState(false)
  const [manualDeposit,setManualDeposit]=useState(null)
  const [wallet,setWallet]=useState(null)
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [walletError,setWalletError]=useState('')
  const loadWallet=useCallback(async()=>{
    setLoading(true)
    setError('')
    setWalletError('')
    const [walletResult, transactionResult] = await Promise.allSettled([
      getWallet(),
      getTransactions({ page: 1, limit: 100 }),
    ])
    if(walletResult.status==='fulfilled')setWallet(walletResult.value)
    else setWalletError(walletResult.reason instanceof Error?walletResult.reason.message:'Unable to load wallet balance. Please try again.')
    if(transactionResult.status==='fulfilled')setRows(transactionResult.value.transactions||[])
    else setError(transactionResult.reason instanceof Error?transactionResult.reason.message:'Unable to load transactions. Please try again.')
    setLoading(false)
  },[])
  async function submitWithdrawal(event){
    event.preventDefault()
    setWithdrawalBusy(true)
    setWithdrawalError('')
    try{
      const values=new FormData(event.currentTarget)
      const withdrawal=await createWithdrawal({
        amount:values.get('amount'),
        upiId:values.get('upiId'),
      })
      setWithdrawalResult(withdrawal.transactionId)
      await loadWallet()
      notify('Withdrawal initiated. Your wallet has been debited and the payout is pending admin processing.')
    }catch(withdrawalFailure){
      setWithdrawalError(withdrawalFailure instanceof Error?withdrawalFailure.message:'Unable to initiate withdrawal.')
    }finally{
      setWithdrawalBusy(false)
    }
  }
  function closeWithdrawal(){
    if(withdrawalBusy)return
    setShowWithdrawal(false)
    setWithdrawalError('')
    setWithdrawalResult(null)
  }
  const loadManualMethod=useCallback(async()=>{
    setManualMethodLoading(true)
    setPaymentError('')
    try{
      setManualMethod(await getActiveManualUpiMethod())
    }catch(methodError){
      setManualMethod(null)
      setPaymentError(methodError?.status===404?'No payment method is currently available.':methodError instanceof Error?methodError.message:'Unable to load the active UPI payment method.')
    }finally{
      setManualMethodLoading(false)
    }
  },[])
  function openAddMoney(){
    setShowAddMoney(true)
    setManualMethod(null)
    void loadManualMethod()
  }
  async function createManualDeposit(event){
    event.preventDefault()
    if(!manualMethod)return
    setPaymentBusy(true)
    setPaymentError('')
    try{
      const form=new FormData(event.currentTarget)
      const deposit=await submitManualDeposit({
        amount:form.get('amount'),
        proofFile:form.get('proof'),
      })
      setManualDeposit(deposit)
      await loadWallet()
      notify('Manual deposit submitted for admin review. Wallet not credited.')
    }catch(depositError){
      setPaymentError(depositError instanceof Error?depositError.message:'Unable to submit manual deposit.')
    }finally{
      setPaymentBusy(false)
    }
  }
  async function createRazorpayDeposit(event){
    event.preventDefault()
    if(razorpayLock.current)return
    if(!RAZORPAY_KEY_ID){setRazorpayError('Online payments are not configured. Please use UPI or contact support.');return}
    const amount=Number(new FormData(event.currentTarget).get('razorpayAmount'))
    if(!Number.isFinite(amount)||amount<=0){setRazorpayError('Enter a valid amount.');return}
    razorpayLock.current=true
    setRazorpayBusy(true)
    setRazorpayError('')
    try{
      const loaded=await loadRazorpayCheckout()
      if(!loaded)throw new Error('Unable to load Razorpay Checkout. Please try again.')
      if(!orderRequestId.current||orderRequestId.current.amount!==amount){
        orderRequestId.current={amount,id:globalThis.crypto?.randomUUID?.()||`deposit-${Date.now()}-${Math.random().toString(36).slice(2)}`}
      }
      const order=await createRazorpayOrder({amount,clientRequestId:orderRequestId.current.id})
      if(!order?.gatewayOrderId||!Number.isFinite(Number(order.amount))||Number(order.amount)<=0)throw new Error('The payment order response was incomplete. Retry to resume this request.')
      const checkout=new window.Razorpay({
        key:RAZORPAY_KEY_ID,
        amount:Math.round(Number(order.amount)*100),
        currency:'INR',
        order_id:order.gatewayOrderId,
        name:'PlayNexa',
        description:'Add money to your PlayNexa wallet',
        prefill:{
          name:user?.fullName||user?.user_metadata?.full_name||'',
          email:user?.email||'',
          contact:user?.phone||'',
        },
        handler:async payment=>{
          checkoutPaymentReceived.current=true
          await verifyRazorpayIdentifiers({
            razorpay_order_id:payment.razorpay_order_id,
            razorpay_payment_id:payment.razorpay_payment_id,
            razorpay_signature:payment.razorpay_signature,
          })
        },
        modal:{
          ondismiss:()=>{
            razorpayLock.current=false
            setRazorpayBusy(false)
            if(!checkoutPaymentReceived.current){
              setRazorpayError('Checkout was closed. Your transaction remains pending; retry the same request when ready.')
              void loadWallet()
            }
          },
        },
        theme:{color:'#635bff'},
      })
      checkoutPaymentReceived.current=false
      checkout.on('payment.failed',failure=>{
        razorpayLock.current=false
        setRazorpayBusy(false)
        setRazorpayError(failure?.error?.description||'Payment failed. You can retry this deposit.')
        void loadWallet()
      })
      checkout.open()
    }catch(orderFailure){
      razorpayLock.current=false
      setRazorpayBusy(false)
      setRazorpayError(orderFailure instanceof Error?orderFailure.message:'Unable to start Razorpay Checkout. Please retry.')
    }
  }
  async function verifyRazorpayIdentifiers(identifiers){
    if(verificationLock.current)return
    verificationLock.current=true
    setRazorpayBusy(true)
    setRazorpayError('')
    try{
      const result=await verifyRazorpayPayment(identifiers)
      if(result?.status==='SUCCESS'){
        setVerificationData({transactionId:result.transactionId,status:'SUCCESS',identifiers})
        orderRequestId.current=null
        notify('Payment successful. PlayNexa verified the payment and refreshed your wallet.')
      }else{
        setVerificationData({identifiers})
        setRazorpayError('Payment is not yet confirmed by PlayNexa. Your transaction remains pending; retry verification shortly.')
      }
    }catch(verificationFailure){
      setVerificationData({identifiers})
      setRazorpayError(verificationFailure instanceof Error?`${verificationFailure.message} Payment is not confirmed. Retry verification shortly.`:'Payment verification failed. Payment is not confirmed; retry verification shortly.')
    }finally{
      await loadWallet()
      verificationLock.current=false
      razorpayLock.current=false
      setRazorpayBusy(false)
    }
  }
  async function retryRazorpayVerification(){
    if(!verificationData?.identifiers||verificationLock.current)return
    await verifyRazorpayIdentifiers(verificationData.identifiers)
  }
  function closePaymentModal(){
    if(paymentBusy)return
    setShowAddMoney(false)
    setPaymentError('')
    setManualMethod(null)
    setManualDeposit(null)
  }
  useEffect(()=>{
    let cancelled=false
    queueMicrotask(()=>{if(!cancelled)loadWallet()})
    return()=>{cancelled=true}
  },[loadWallet])
  useEffect(()=>subscribeToWalletUpdates(()=>void loadWallet()),[loadWallet])
  const creditTypes=['ADD_MONEY','GAME_WIN','GAME_REFUND']
  const visible=rows.filter(row=>filter==='All'||(filter==='Credits'?creditTypes.includes(row.transactionType):!creditTypes.includes(row.transactionType)))
  return <>
    <PageTitle eyebrow="WALLET & PAYMENTS" title="Your wallet" subtitle="Manage funds securely and review every transaction."/>
    <div className="wallet-hero">
      <div><small>AVAILABLE BALANCE</small><strong>{loading?'Loading…':wallet?formatINR(Number(wallet.balance)):'—'}</strong><span role={walletError?'alert':undefined}>{walletError||'Wallet protected and ready'}</span></div>
      <div className="button-row"><Button onClick={openAddMoney}><ArrowDownLeft size={16}/> Add money</Button><Button variant="secondary" onClick={()=>{setWithdrawalError('');setWithdrawalResult(null);setShowWithdrawal(true)}}>Withdraw <ArrowUpRight size={16}/></Button></div>
    </div>
    <Panel title="Transaction history" subtitle="Track deposits, match entries, and winnings" action={<div className="filter-tabs compact">{['All','Credits','Debits'].map(item=><button type="button" aria-pressed={filter===item} className={filter===item?'selected':''} key={item} onClick={()=>setFilter(item)}>{item}</button>)}</div>}>
      <DataState loading={loading} error={error} retry={loadWallet} empty={!visible.length}><TransactionRows rows={visible}/></DataState>
    </Panel>
    {showAddMoney&&<Modal title="Add money" onClose={closePaymentModal}>
      {paymentError&&<p className="auth-error" role="alert">{paymentError}</p>}
      {!manualDeposit&&<section className="form-stack" aria-label="Razorpay deposit">
        <h3>Add money with Razorpay</h3>
        {razorpayError&&<p className="auth-error" role="alert">{razorpayError}</p>}
        {verificationData?.status==='SUCCESS'&&<p className="notice" role="status">Payment successful. Transaction {verificationData.transactionId?.slice(0,8)}.</p>}
        {verificationData?.identifiers&&!verificationData.status&&<Button type="button" onClick={retryRazorpayVerification} disabled={razorpayBusy}>{razorpayBusy?'Verifying…':'Retry payment verification'}</Button>}
        {!verificationData?.status&&<form className="form-stack" onSubmit={createRazorpayDeposit}>
          <FormField label="Amount (₹)"><input name="razorpayAmount" type="number" min="1" max="100000" step="0.01" defaultValue="500" required disabled={razorpayBusy}/></FormField>
          <Button type="submit" disabled={razorpayBusy}>{razorpayBusy?'Starting secure checkout…':'Pay securely with Razorpay'}</Button>
        </form>}
      </section>}
      {!manualDeposit&&<form className="form-stack" onSubmit={createManualDeposit}>
        <FormField label="Amount (₹)"><input name="amount" type="number" min="100" max="100000" step="0.01" defaultValue="500" required/></FormField>
        {manualMethodLoading?<div role="status">Loading active UPI method…</div>:manualMethod?<div className="manual-upi-details"><strong>{manualMethod.payeeName}</strong><span>Payee: {manualMethod.payeeName}</span><span>UPI ID: <strong>{manualMethod.upiId}</strong></span>{manualMethod.qrUrl&&<GameImage src={manualMethod.qrUrl} alt="Active UPI payment QR code" style={{width:180,maxHeight:180,objectFit:'contain',alignSelf:'center'}}/>}<p className="form-disclaimer">Pay the amount above using your UPI app, then upload the payment screenshot. Your deposit remains pending until admin review; it will not credit your wallet automatically.</p><FormField label="Payment screenshot"><input name="proof" type="file" accept="image/jpeg,image/png,image/webp" required/></FormField></div>:<p role="status">No active UPI payment method is available. Contact support for help.</p>}
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={closePaymentModal}>Cancel</Button><Button type="submit" disabled={paymentBusy||!manualMethod||manualMethodLoading}>{paymentBusy?'Submitting…':'I have paid — submit for review'}</Button></div>
      </form>}
      {manualDeposit&&<div className="form-stack"><div className="notice"><ShieldCheck size={18}/><p>Deposit submitted for review. No wallet credit has been made.</p></div><p>Request {manualDeposit.transactionId.slice(0,8)} · {formatINR(Number(manualDeposit.amount))}</p><Status>{manualDeposit.status}</Status><div className="modal-actions"><Button variant="secondary" onClick={closePaymentModal}>Close</Button></div></div>}
    </Modal>}
    {showWithdrawal&&<Modal title="Withdraw to UPI" onClose={closeWithdrawal}>
      {withdrawalError&&<p className="auth-error" role="alert">{withdrawalError}</p>}
      {withdrawalResult?<div className="form-stack"><div className="notice"><ShieldCheck size={18}/><p>Your withdrawal request is initiated. The amount has been deducted from your wallet and will be processed by an administrator.</p></div><p>Withdrawal {withdrawalResult.slice(0,8)} · Status: INITIATED</p><div className="modal-actions"><Button variant="secondary" onClick={closeWithdrawal}>Close</Button></div></div>:<form className="form-stack" onSubmit={submitWithdrawal}>
        <FormField label="Amount (₹)" hint={wallet?`Available balance: ${formatINR(Number(wallet.balance))}`:'Wallet balance unavailable'}><input name="amount" type="number" min="0.01" max={wallet?.balance||undefined} step="0.01" placeholder="Enter amount" required disabled={!wallet||Number(wallet.balance)<=0}/></FormField>
        <FormField label="UPI ID"><input name="upiId" type="text" autoComplete="off" placeholder="name@bank" maxLength="200" pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,254}@[A-Za-z0-9][A-Za-z0-9.-]{0,63}" required/></FormField>
        <p className="form-disclaimer">The requested amount is deducted immediately. An administrator will process the UPI payout; rejected requests are refunded to your wallet.</p>
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={closeWithdrawal}>Cancel</Button><Button type="submit" disabled={withdrawalBusy||!wallet||Number(wallet.balance)<=0}>{withdrawalBusy?'Submitting…':'Request withdrawal'}</Button></div>
      </form>}
    </Modal>}
  </>
}
