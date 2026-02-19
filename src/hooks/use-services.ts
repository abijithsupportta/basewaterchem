'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Service, ServiceFormData, ServiceCompleteData, UpcomingServiceView } from '@/types';

export function useServices(filters?: {
  status?: string;
  type?: string;
  technicianId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('services')
        .select(`
          *,
          customer:customers (id, full_name, phone, customer_code),
          customer_product:customer_products (
            id, serial_number,
            product:products (id, name, brand, model)
          ),
          technician:staff!services_assigned_technician_id_fkey (id, full_name, phone)
        `)
        .order('scheduled_date', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.type) query = query.eq('service_type', filters.type);
      if (filters?.technicianId) query = query.eq('assigned_technician_id', filters.technicianId);
      if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
      if (filters?.dateFrom) query = query.gte('scheduled_date', filters.dateFrom);
      if (filters?.dateTo) query = query.lte('scheduled_date', filters.dateTo);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setServices(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase, filters?.status, filters?.type, filters?.technicianId, filters?.customerId, filters?.dateFrom, filters?.dateTo]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const getService = async (id: string) => {
    const { data, error } = await supabase
      .from('services')
      .select(`
        *,
        customer:customers (*),
        customer_product:customer_products (*, product:products (*)),
        technician:staff!services_assigned_technician_id_fkey (*),
        amc_contract:amc_contracts (*),
        complaint:complaints (*)
      `)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  };

  const createService = async (formData: ServiceFormData) => {
    const { data, error } = await supabase
      .from('services')
      .insert(formData)
      .select()
      .single();
    if (error) throw error;
    await fetchServices();
    return data;
  };

  const updateService = async (id: string, formData: Partial<Service>) => {
    const { data, error } = await supabase
      .from('services')
      .update(formData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await fetchServices();
    return data;
  };

  const completeService = async (id: string, completeData: ServiceCompleteData) => {
    const { data, error } = await supabase
      .from('services')
      .update({
        ...completeData,
        status: 'completed',
        total_amount: (completeData.parts_cost || 0) + (completeData.service_charge || 0),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await fetchServices();
    return data;
  };

  const assignTechnician = async (serviceId: string, technicianId: string) => {
    const { data, error } = await supabase
      .from('services')
      .update({
        assigned_technician_id: technicianId,
        status: 'assigned',
      })
      .eq('id', serviceId)
      .select()
      .single();
    if (error) throw error;
    await fetchServices();
    return data;
  };

  return {
    services,
    loading,
    error,
    fetchServices,
    getService,
    createService,
    updateService,
    completeService,
    assignTechnician,
  };
}

export function useUpcomingServices() {
  const [services, setServices] = useState<UpcomingServiceView[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data, error } = await supabase
          .from('upcoming_services_view')
          .select('*')
          .order('scheduled_date', { ascending: true })
          .limit(50);
        if (error) throw error;
        setServices(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [supabase]);

  return { services, loading };
}
