// app/lib/payment-gateway.ts
import crypto from "crypto";

export type PaymentGatewayType = "none" | "razorpay" | "cashfree" | "upi_qr";

export type PaymentConfig = {
  payment_gateway: PaymentGatewayType;
  payment_enabled: boolean;
  payment_amount_type: "full" | "partial" | "advance";
  advance_percentage: number;
  razorpay_key_id?: string;
  razorpay_key_secret?: string;
  cashfree_app_id?: string;
  cashfree_secret_key?: string;
  upi_id?: string;
  upi_qr_url?: string;
  payment_notes?: string;
};

export type CreateOrderInput = {
  amount: number;
  currency: string;
  receipt: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: Record<string, string>;
  returnUrl: string;
};

export type CreateOrderResult = {
  success: boolean;
  orderId?: string;
  paymentLink?: string;
  publicKey?: string;
  amount?: number;
  gateway?: PaymentGatewayType;
  error?: string;
};

export async function createRazorpayOrder(
  config: PaymentConfig,
  input: CreateOrderInput
): Promise<CreateOrderResult> {
  try {
    if (!config.razorpay_key_id || !config.razorpay_key_secret) {
      throw new Error("Razorpay keys not configured");
    }

    const auth = Buffer.from(
      `${config.razorpay_key_id}:${config.razorpay_key_secret}`
    ).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes || {},
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.description || "Razorpay order failed");
    }

    return {
      success: true,
      orderId: data.id,
      publicKey: config.razorpay_key_id,
      amount: data.amount,
      gateway: "razorpay",
    };
  } catch (error: any) {
    console.error("[Razorpay Order]", error);
    return { success: false, error: error.message };
  }
}

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

export async function createCashfreeOrder(
  config: PaymentConfig,
  input: CreateOrderInput
): Promise<CreateOrderResult> {
  try {
    if (!config.cashfree_app_id || !config.cashfree_secret_key) {
      throw new Error("Cashfree keys not configured");
    }

    const orderId = `order_${input.receipt}_${Date.now()}`;

    const response = await fetch("https://api.cashfree.com/pg/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": config.cashfree_app_id,
        "x-client-secret": config.cashfree_secret_key,
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: input.amount,
        order_currency: input.currency,
        customer_details: {
          customer_id: `cust_${Date.now()}`,
          customer_name: input.customerName,
          customer_phone: input.customerPhone,
          customer_email: input.customerEmail || "guest@example.com",
        },
        order_meta: {
          return_url: `${input.returnUrl}?order_id={order_id}`,
        },
        order_note: input.notes?.purpose || "Hotel Booking",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Cashfree order failed");
    }

    return {
      success: true,
      orderId: data.order_id,
      paymentLink: data.payment_session_id,
      amount: data.order_amount,
      gateway: "cashfree",
    };
  } catch (error: any) {
    console.error("[Cashfree Order]", error);
    return { success: false, error: error.message };
  }
}

export async function getCashfreeOrderStatus(
  config: PaymentConfig,
  orderId: string
): Promise<{ status: string; amount: number; paymentId?: string }> {
  const response = await fetch(
    `https://api.cashfree.com/pg/orders/${orderId}`,
    {
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": config.cashfree_app_id!,
        "x-client-secret": config.cashfree_secret_key!,
      },
    }
  );

  const data = await response.json();
  return {
    status: data.order_status,
    amount: data.order_amount,
    paymentId: data.payments?.[0]?.cf_payment_id,
  };
}

export function calculatePaymentAmount(
  total: number,
  config: PaymentConfig
): number {
  if (config.payment_amount_type === "full") return total;
  if (config.payment_amount_type === "advance") {
    return Math.round((total * (config.advance_percentage || 100)) / 100);
  }
  return total;
}
