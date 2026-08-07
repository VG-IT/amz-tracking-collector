// domain/Order.ts
import {Shipment} from "./Shipment"
import {OrderCost} from "./OrderCost"

export interface Order {
  orderNumber: string;
  orderDate: string | null;
  status?: string | null;
  shipTo: string | null;
  cost: any;
	shipments: Record<string, Shipment>;
	paymentMethod?: string;
	address: string;
}

