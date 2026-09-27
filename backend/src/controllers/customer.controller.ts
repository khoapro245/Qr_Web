import {
  createCustomerSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
  updateOwnProfileSchema,
  updateStatusSchema,
} from '@qrcare/shared';
import type { Request, Response } from 'express';
import { getAuth } from '../middleware/authenticate.js';
import { parseInput } from '../middleware/validate.js';
import * as customers from '../services/customer.service.js';
import { getDashboardStats } from '../services/dashboard.service.js';
import { customerId } from './params.js';

export async function dashboard(_req: Request, res: Response) {
  const [stats, recentCustomers] = await Promise.all([
    getDashboardStats(),
    customers.recentCustomers(),
  ]);
  res.json({ success: true, data: { stats, recentCustomers } });
}

export async function list(req: Request, res: Response) {
  const query = parseInput(listCustomersQuerySchema, req.query);
  res.json({ success: true, data: await customers.listCustomersForAdmin(query) });
}

export async function create(req: Request, res: Response) {
  const input = parseInput(createCustomerSchema, req.body);
  const result = await customers.createCustomer(getAuth(req).userId, input);
  res.status(201).json({ success: true, data: result });
}

export async function detail(req: Request, res: Response) {
  const customer = await customers.getCustomerForAdmin(customerId(req));
  res.json({ success: true, data: { customer } });
}

export async function update(req: Request, res: Response) {
  const id = customerId(req);
  const input = parseInput(updateCustomerSchema, req.body);
  const customer = await customers.updateCustomer(getAuth(req).userId, id, input);
  res.json({ success: true, data: { customer } });
}

export async function setStatus(req: Request, res: Response) {
  const id = customerId(req);
  const { status } = parseInput(updateStatusSchema, req.body);
  const customer = await customers.setCustomerStatus(getAuth(req).userId, id, status);
  res.json({ success: true, data: { customer } });
}

export async function resetPassword(req: Request, res: Response) {
  const result = await customers.resetCustomerPassword(getAuth(req).userId, customerId(req));
  res.json({ success: true, data: result });
}

export async function ownProfile(req: Request, res: Response) {
  res.json({ success: true, data: await customers.getOwnProfile(getAuth(req).userId) });
}

export async function updateOwnProfile(req: Request, res: Response) {
  // The schema only knows profile fields; anything else sent (email, role, avatar, age...)
  // is stripped, so customers cannot change what they are not allowed to.
  const input = parseInput(updateOwnProfileSchema, req.body);
  const profile = await customers.updateOwnProfile(getAuth(req).userId, input);
  res.json({ success: true, data: profile });
}
