import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Status } from '../../components/common';
import { formatINR } from '../../data/mockData';

export function TransactionRows({rows}) {
  return (
    <div className="transaction-list">
      {rows.map(transaction => {
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
