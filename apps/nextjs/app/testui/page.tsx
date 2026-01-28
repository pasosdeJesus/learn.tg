
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CircularProgress } from "@/components/ui/circular-progress";
import { CompletedProgress } from "@/components/ui/completed-progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { QrCodeDialog } from "@/components/ui/qr-code-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function TestUiPage() {
  return (
    <div className="container mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold">UI Component Showcase</h1>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Accordion</h2>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Is it accessible?</AccordionTrigger>
            <AccordionContent>
              Yes. It adheres to the WAI-ARIA design pattern.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Is it styled?</AccordionTrigger>
            <AccordionContent>
              Yes. It comes with default styles that matches the other components' aesthetics.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Alert Dialog</h2>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Show Dialog</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your account
                and remove your data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Alert</h2>
        <Alert>
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>
            You can add components to your app using the cli.
          </AlertDescription>
        </Alert>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Avatar</h2>
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Badge</h2>
        <div className="flex gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Button</h2>
        <div className="flex gap-2">
          <Button>Default</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Card</h2>
        <Card className="w-[350px]">
          <CardHeader>
            <CardTitle>Create project</CardTitle>
            <CardDescription>Deploy your new project in one-click.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Card Content</p>
          </CardContent>
          <CardFooter>
            <p>Card Footer</p>
          </CardFooter>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Checkbox</h2>
        <div className="flex items-center space-x-2">
          <Checkbox id="terms" />
          <Label htmlFor="terms">Accept terms and conditions</Label>
        </div>
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Circular Progress</h2>
        <CircularProgress value={60} />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Completed Progress</h2>
        <CompletedProgress value={75} />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Dialog</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Edit Profile</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit profile</DialogTitle>
              <DialogDescription>
                Make changes to your profile here. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <p>This is the dialog content.</p>
            </div>
            <DialogFooter>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Dropdown Menu</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Open Menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuItem>Team</DropdownMenuItem>
            <DropdownMenuItem>Subscription</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Input</h2>
        <Input type="email" placeholder="Email" className="w-[350px]" />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Label</h2>
        <Label htmlFor="email-input">Your Email</Label>
        <Input type="email" id="email-input" placeholder="Email" className="w-[350px]" />
      </div>

      <div>
          <h2 className="text-2xl font-semibold mb-4">Menubar</h2>
          <Menubar>
            <MenubarMenu>
              <MenubarTrigger>File</MenubarTrigger>
              <MenubarContent>
                <MenubarItem>New Tab</MenubarItem>
                <MenubarSeparator />
                <MenubarItem>Share</MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Popover</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Open popover</Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <p>This is the popover content.</p>
          </PopoverContent>
        </Popover>
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Progress</h2>
        <Progress value={33} className="w-[60%]" />
      </div>
      
      <div>
          <h2 className="text-2xl font-semibold mb-4">QR Code Dialog</h2>
          <QrCodeDialog
            title="Scan QR Code"
            qrData="https://example.com"
            triggerButton={
              <Button variant="outline">Show QR Code</Button>
            }
          />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Radio Group</h2>
        <RadioGroup defaultValue="comfortable">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="default" id="r1" />
            <Label htmlFor="r1">Default</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="comfortable" id="r2" />
            <Label htmlFor="r2">Comfortable</Label>
          </div>
        </RadioGroup>
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Scroll Area</h2>
        <ScrollArea className="h-48 w-48 rounded-md border p-4">
          Jokester began sneaking into the castle in the middle of the night and leaving jokes all over the place: under the king's pillow, in his soup, even in the royal toilet. The king was furious, but he couldn't seem to stop Jokester.
        </ScrollArea>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Select</h2>
        <Select>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div>
          <h2 className="text-2xl font-semibold mb-4">Separator</h2>
          <div className="space-y-2">
            <p>First item</p>
            <Separator />
            <p>Second item</p>
          </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Sheet</h2>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Open Sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Are you sure absolutely sure?</SheetTitle>
              <SheetDescription>
                This action cannot be undone.
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Skeleton</h2>
        <div className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </div>
      
      <div>
          <h2 className="text-2xl font-semibold mb-4">Slider</h2>
          <Slider defaultValue={[50]} max={100} step={1} className="w-[60%]" />
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Switch</h2>
        <div className="flex items-center space-x-2">
          <Switch id="airplane-mode" />
          <Label htmlFor="airplane-mode">Airplane Mode</Label>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Table</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Header 1</TableHead>
              <TableHead>Header 2</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Cell 1.1</TableCell>
              <TableCell>Cell 1.2</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Tabs</h2>
        <Tabs defaultValue="account" className="w-[400px]">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>
          <TabsContent value="account">
            Make changes to your account here.
          </TabsContent>
          <TabsContent value="password">
            Change your password here.
          </TabsContent>
        </Tabs>
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Textarea</h2>
        <Textarea placeholder="Type your message here." />
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Tooltip</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover</Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add to library</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
