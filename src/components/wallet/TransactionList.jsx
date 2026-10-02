import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Status } from '../../components/common';
import { formatINR } from '../../data/mockData';
import { formatIndiaDateTime } from '../../utils/formatDate';

const CREDIT_TYPES = new Set(['ADD_MONEY', 'GAME_WIN', 'GAME_REFUND']);
const TRANSACTION_LABELS = {
  ADD_MONEY: 'Wallet top-up',
  WITHDRAW: 'Withdrawal',
  GAME_CREATE: 'Match entry',
  GAME_JOIN: 'Match entry',
  GAME_WIN: 'Match winnings',
  GAME_REFUND: 'Match refund',
};

function displayTransaction(transaction) {
  if (transaction.transactionType) {
    const kind = CREDIT_TYPES.has(transaction.transactionType) ? 'credit' : 'debit';
    const amount = Number(transaction.amount || 0);
    return {
      id: transaction.id,
      title: TRANSACTION_LABELS[transaction.transactionType] || transaction.transactionType,
      date: formatIndiaDateTime(transaction.createdAt),
      amount: kind === 'credit' ? Math.abs(amount) : -Math.abs(amount),
      status: transaction.status,
    };
  }

  return transaction;
}

export function TransactionRows({rows}) {
  return (
    <div className="transaction-list">
      {rows.map(item => {
        const transaction = displayTransaction(item);
        const isCredit = transaction.amount > 0;
        const AmountIcon = isCredit ? ArrowDownLeft : ArrowUpRight;
        const amountLabel = `${isCredit ? '+' : ''}${formatINR(transaction.amount)}`;

        return (
          <div className="transaction-row" key={transaction.id}>
            <span className={`transaction-icon ${isCredit ? 'credit' : ''}`}>
              <AmountIcon size={16} />
            </span>
            <div className="row-grow">
              <strong>{transaction.title}</strong>
              <small>{transaction.date} · {transaction.id}</small>
            </div>
            <strong className={isCredit ? 'positive-text' : ''}>{amountLabel}</strong>
            <Status>{transaction.status}</Status>
          </div>
        );
      })}
    </div>
  );
}
