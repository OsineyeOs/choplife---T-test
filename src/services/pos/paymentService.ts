export const processPayment = async (
  checkId: string,
  paymentMethod: string,
  paymentDetails: any,
  shiftId?: string,
  authHeaders?: Record<string, string>
) => {
  const res = await fetch(`/api/pos/checks/${checkId}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      paymentMethod,
      paymentDetails,
      shiftId,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to complete payment');
  }

  return res.json();
};

export const chargeWallet = async (
  customerId: string,
  amount: number,
  orderId: string,
  orderNumber: string,
  note: string,
  authHeaders?: Record<string, string>
) => {
  const res = await fetch(`/api/customers/${customerId}/charge-wallet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ amount, orderId, orderNumber, note }),
  });
  if (!res.ok) throw new Error('Failed to charge wallet');
  return res.json();
};

export const chargeHouseAccount = async (
  accountId: string,
  amount: number,
  orderId: string,
  checkNumber: string,
  notes: string,
  authorizedSigner: string,
  authHeaders?: Record<string, string>
) => {
  const res = await fetch(`/api/house-accounts/${accountId}/charge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ amount, orderId, checkNumber, notes, authorizedSigner }),
  });
  if (!res.ok) throw new Error('Failed to charge house account');
  return res.json();
};
