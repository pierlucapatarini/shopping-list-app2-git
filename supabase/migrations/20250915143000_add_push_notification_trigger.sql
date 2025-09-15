CREATE OR REPLACE TRIGGER on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(
    'https://gvcdchndpofcfdvhpyos.supabase.co/functions/v1/send-push-notification',
    '{"Content-Type":"application/json"}',
    '{"family_group": NEW.family_group, "sender_id": NEW.sender_id, "sender_name": NEW.user_metadata.username}',
    'POST'
);