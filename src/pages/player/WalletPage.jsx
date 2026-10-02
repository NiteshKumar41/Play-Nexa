import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Button, DataState, FormField, Modal, PageTitle, Panel, Status } from '../../components/common';
import { formatINR } from '../../utils/currency';
import { createWithdrawal, getTransactions, getWallet } from '../../services/walletService';
import { completeMockPayment, createPaymentOrder, getActiveManualUpiMethod, submitManualDeposit } from '../../services/paymentService';
import { TransactionRows } from '../../components/wallet/TransactionList'

export function WalletPage({notify}) {
  const [filter,setFilter]=useState('All')
  const [showAddMoney,setShowAddMoney]=useState(false)
  const [showWithdrawal,setShowWithdrawal]=useState(false)
  const [withdrawalBusy,setWithdrawalBusy]=useState(false)
  const [withdrawalError,setWithdrawalError]=useState('')
  const [withdrawalResult,setWithdrawalResult]=useState(null)
  const [paymentOrder,setPaymentOrder]=useState(null)
  const [paymentBusy,setPaymentBusy]=useState(false)
  const [paymentError,setPaymentError]=useState('')
  const [paymentResult,setPaymentResult]=useState(null)
  const [depositMethod,setDepositMethod]=useState('gateway')
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
    else setWalletError('Unable to load wallet balance. Please try again.')
    if(transactionResult.status==='fulfilled')setRows(transactionResult.value.transactions||[])
    else setError('Unable to load transactions. Please try again.')
    setLoading(false)
  },[])
  async function createWalletTopUp(event){
    event.preventDefault()
    setPaymentBusy(true)
    setPaymentError('')
    try{
      const amount=new FormData(event.currentTarget).get('amount')
      const result=await createPaymentOrder(amount)
      setPaymentOrder(result)
    }catch(paymentFailure){
      setPaymentError(paymentFailure instanceof Error?paymentFailure.message:'Unable to create a payment order.')
    }finally{
      setPaymentBusy(false)
    }
  }
  async function submitWithdrawal(event){
    event.preventDefault()
    setWithdrawalBusy(true)
    setWithdrawalError('')
    try{
      const values=new FormData(event.currentTarget)
      const withdrawalId=await createWithdrawal({
        amount:Number(values.get('amount')).toFixed(2),
        upiId:values.get('upiId'),
      })
      setWithdrawalResult(withdrawalId)
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
      setPaymentError(methodError instanceof Error?methodError.message:'Unable to load the active UPI payment method.')
    }finally{
      setManualMethodLoading(false)
    }
  },[])
  async function createManualDeposit(event){
    event.preventDefault()
    if(!manualMethod)return
    setPaymentBusy(true)
    setPaymentError('')
    try{
      const form=new FormData(event.currentTarget)
      const deposit=await submitManualDeposit({
        amount:form.get('amount'),
        paymentMethodId:manualMethod.id,
        proofFile:form.get('proof'),
      })
      setManualDeposit(deposit)
      notify('Manual deposit submitted for admin review. Wallet not credited.')
    }catch(depositError){
      setPaymentError(depositError instanceof Error?depositError.message:'Unable to submit manual deposit.')
    }finally{
      setPaymentBusy(false)
    }
  }
  async function simulateDevelopmentPayment(status){
    if(!paymentOrder?.order?.id)return
    setPaymentBusy(true)
    setPaymentError('')
    try{
      const result=await completeMockPayment({orderId:paymentOrder.order.id,status})
      setPaymentResult(result)
      if(status==='SUCCESS')await loadWallet()
      notify(result.message)
    }catch(paymentFailure){
      setPaymentError(paymentFailure instanceof Error?paymentFailure.message:'Development payment simulation failed.')
    }finally{
      setPaymentBusy(false)
    }
  }
  function closePaymentModal(){
    if(paymentBusy)return
    setShowAddMoney(false)
    setPaymentOrder(null)
    setPaymentError('')
    setPaymentResult(null)
    setDepositMethod('gateway')
    setManualMethod(null)
    setManualDeposit(null)
  }
  useEffect(()=>{
    let cancelled=false
    queueMicrotask(()=>{if(!cancelled)loadWallet()})
    return()=>{cancelled=true}
  },[loadWallet])
  const creditTypes=['ADD_MONEY','GAME_WIN','GAME_REFUND']
  const visible=rows.filter(row=>filter==='All'||(filter==='Credits'?creditTypes.includes(row.transactionType):!creditTypes.includes(row.transactionType)))
  return <>
    <PageTitle eyebrow="WALLET & PAYMENTS" title="Your wallet" subtitle="Manage funds securely and review every transaction."/>
    <div className="wallet-hero">
      <div><small>AVAILABLE BALANCE</small><strong>{loading?'Loading…':wallet?formatINR(Number(wallet.balance)):'—'}</strong><span role={walletError?'alert':undefined}>{walletError||'Wallet protected and ready'}</span></div>
      <div className="button-row"><Button onClick={()=>setShowAddMoney(true)}><ArrowDownLeft size={16}/> Add money</Button><Button variant="secondary" onClick={()=>{setWithdrawalError('');setWithdrawalResult(null);setShowWithdrawal(true)}}>Withdraw <ArrowUpRight size={16}/></Button></div>
    </div>
    <Panel title="Transaction history" subtitle="Track deposits, match entries, and winnings" action={<div className="filter-tabs compact">{['All','Credits','Debits'].map(item=><button type="button" aria-pressed={filter===item} className={filter===item?'selected':''} key={item} onClick={()=>setFilter(item)}>{item}</button>)}</div>}>
      <DataState loading={loading} error={error} retry={loadWallet} empty={!visible.length}><TransactionRows rows={visible}/></DataState>
    </Panel>
    {showAddMoney&&<Modal title={paymentOrder?'Development checkout':'Add money'} onClose={closePaymentModal}>
      {paymentError&&<p className="auth-error" role="alert">{paymentError}</p>}
      {!paymentOrder&&!manualDeposit&&<form className="form-stack" onSubmit={depositMethod==='gateway'?createWalletTopUp:createManualDeposit}>
        <FormField label="Deposit method"><select value={depositMethod} onChange={event=>{const method=event.target.value;setDepositMethod(method);setPaymentError('');if(method==='manual'){setManualMethod(null);loadManualMethod()}}}><option value="gateway">Payment gateway</option><option value="manual">Manual UPI</option></select></FormField>
        <FormField label="Amount (₹)"><input name="amount" type="number" min="100" max="100000" step="0.01" defaultValue="500" required/></FormField>
        {depositMethod==='gateway'&&<p className="form-disclaimer">The wallet is credited only after server-side payment verification. Development checkout is a simulation, not a real payment.</p>}
        {depositMethod==='manual'&&<>{manualMethodLoading?<div role="status">Loading active UPI method…</div>:manualMethod?<div className="manual-upi-details"><strong>{manualMethod.display_name}</strong><span>Payee: {manualMethod.payee_name}</span><span>UPI ID: <strong>{manualMethod.upi_id}</strong></span>{manualMethod.qrUrl&&<img src={manualMethod.qrUrl} alt="Active UPI payment QR code" style={{width:180,maxHeight:180,objectFit:'contain',alignSelf:'center'}}/>}<p className="form-disclaimer">Pay the amount above using your UPI app, then upload the payment screenshot. Your deposit remains pending until admin review; it will not credit your wallet automatically.</p><FormField label="Payment screenshot"><input name="proof" type="file" accept="image/jpeg,image/png,image/webp" required/></FormField></div>:<p role="status">No active manual UPI payment method is available. Choose gateway or contact support.</p>}</>}
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={closePaymentModal}>Cancel</Button><Button type="submit" disabled={paymentBusy||(depositMethod==='manual'&&(!manualMethod||manualMethodLoading))}>{paymentBusy?'Submitting…':depositMethod==='manual'?'I have paid — submit for review':'Continue to checkout'}</Button></div>
      </form>}
      {manualDeposit&&<div className="form-stack"><div className="notice"><ShieldCheck size={18}/><p>Deposit submitted for review. No wallet credit has been made.</p></div><p>Request {manualDeposit.id.slice(0,8)} · {formatINR(Number(manualDeposit.amount))}</p><Status>{manualDeposit.status}</Status><div className="modal-actions"><Button variant="secondary" onClick={closePaymentModal}>Close</Button></div></div>}
      {paymentOrder&&<div className="form-stack">
        <div className="notice"><ShieldCheck size={18}/><p>{paymentOrder.checkout?.message||'Continue using the payment method provided by the payment service.'}</p></div>
        <p>Order {paymentOrder.order.id.slice(0,8)} · {formatINR(Number(paymentOrder.order.amount))} {paymentOrder.order.currency}</p>
        {paymentResult?<><Status>{paymentResult.status}</Status><p>{paymentResult.message}</p></>:paymentOrder.checkout?.mode==='mock'&&<div className="button-row"><Button disabled={paymentBusy} onClick={()=>simulateDevelopmentPayment('SUCCESS')}>{paymentBusy?'Processing…':'Simulate successful payment'}</Button><Button variant="secondary" disabled={paymentBusy} onClick={()=>simulateDevelopmentPayment('FAILED')}>Simulate failed payment</Button><Button variant="ghost" disabled={paymentBusy} onClick={()=>simulateDevelopmentPayment('CANCELLED')}>Cancel checkout</Button></div>}
        {paymentResult&&<div className="modal-actions"><Button variant="secondary" onClick={closePaymentModal}>Close</Button></div>}
      </div>}
    </Modal>}
    {showWithdrawal&&<Modal title="Withdraw to UPI" onClose={closeWithdrawal}>
      {withdrawalError&&<p className="auth-error" role="alert">{withdrawalError}</p>}
      {withdrawalResult?<div className="form-stack"><div className="notice"><ShieldCheck size={18}/><p>Your withdrawal request is initiated. The amount has been deducted from your wallet and will be processed by an administrator.</p></div><p>Withdrawal {withdrawalResult.slice(0,8)} · Status: INITIATED</p><div className="modal-actions"><Button variant="secondary" onClick={closeWithdrawal}>Close</Button></div></div>:<form className="form-stack" onSubmit={submitWithdrawal}>
        <FormField label="Amount (₹)" hint={wallet?`Available balance: ${formatINR(Number(wallet.balance))}`:'Wallet balance unavailable'}><input name="amount" type="number" min="0.01" max={wallet?.balance||undefined} step="0.01" placeholder="Enter amount" required disabled={!wallet||Number(wallet.balance)<=0}/></FormField>
        <FormField label="UPI ID"><input name="upiId" type="text" autoComplete="off" placeholder="name@bank" maxLength="255" pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,254}@[A-Za-z0-9][A-Za-z0-9.-]{0,63}" required/></FormField>
        <p className="form-disclaimer">The requested amount is deducted immediately. An administrator will process the UPI payout; rejected requests are refunded to your wallet.</p>
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={closeWithdrawal}>Cancel</Button><Button type="submit" disabled={withdrawalBusy||!wallet||Number(wallet.balance)<=0}>{withdrawalBusy?'Submitting…':'Request withdrawal'}</Button></div>
      </form>}
    </Modal>}
  </>
}
