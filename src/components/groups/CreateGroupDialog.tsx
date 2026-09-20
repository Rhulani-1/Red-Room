import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  trigger?: React.ReactNode;
  onCreated?: (groupId: string) => void;
}

const CreateGroupDialog = ({ trigger, onCreated }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [subscribersFree, setSubscribersFree] = useState(true);

  const handleCreate = async () => {
    if (!user) {
      toast.error("Sign in to create a group");
      return;
    }
    if (!name.trim()) {
      toast.error("Group name required");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("groups")
      .insert({
        creator_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        pass_price: Number(price) || 0,
        subscribers_free: subscribersFree,
      })
      .select("id")
      .single();
    setLoading(false);

    if (error || !data) {
      toast.error(error?.message ?? "Failed to create group");
      return;
    }
    toast.success("Group created");
    setOpen(false);
    setName("");
    setDescription("");
    setPrice("0");
    onCreated?.(data.id);
    navigate(`/groups/${data.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="bg-gradient-ember glow">
            <Plus className="mr-1 h-4 w-4" /> New Group
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Create Premium Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Inner Circle" maxLength={60} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this group about?" maxLength={300} />
          </div>
          <div>
            <Label>One-time pass price (R)</Label>
            <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            <p className="mt-1 text-[11px] text-muted-foreground">Set 0 for subscriber-only access.</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-semibold">Subscribers join free</p>
              <p className="text-[11px] text-muted-foreground">Active subscribers get instant access.</p>
            </div>
            <Switch checked={subscribersFree} onCheckedChange={setSubscribersFree} />
          </div>
          <Button onClick={handleCreate} disabled={loading} className="w-full bg-gradient-ember glow">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupDialog;
