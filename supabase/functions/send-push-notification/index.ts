import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.4.1";
import webpush from "npm:web-push";
// Configura le chiavi VAPID
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "BLDdQAO8gueA1ptO87Bwodv5ywLyAfWYRGtMQZI9UrD2PYlk431sghgAhlZtnUULPM-Uc6MajxQwnmrnfe0qrPE";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "2MBjpR1GFff1CFW5OPBA5axnTBXBykgIeZx3zTlCKfw";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? 'mailto:pierluca.patarini@icloud.com';
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
serve(async (req)=>{
  try {
    const { message_id, family_group, sender_id, sender_name } = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? '';
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? '';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('subscription, user_id').eq('family_group', family_group);
    if (error) {
      console.error('Error fetching subscriptions:', error);
      return new Response(JSON.stringify({
        error: 'Failed to fetch subscriptions.'
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const filteredSubscriptions = subscriptions.filter((sub)=>sub.user_id !== sender_id);
    if (filteredSubscriptions.length === 0) {
      return new Response(JSON.stringify({
        message: "No other users to notify."
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const payload = JSON.stringify({
      title: `Nuovo messaggio da ${sender_name}`,
      body: 'Tocca per aprire la chat',
      url: '/'
    });
    const pushPromises = filteredSubscriptions.map((sub)=>{
      const subscription = sub.subscription;
      return webpush.sendNotification(subscription, payload);
    });
    await Promise.allSettled(pushPromises);
    return new Response(JSON.stringify({
      message: "Notifications sent successfully"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (e) {
    console.error("Error in function:", e);
    return new Response(JSON.stringify({
      error: e.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
