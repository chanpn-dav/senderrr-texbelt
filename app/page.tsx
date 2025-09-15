"use client"

import type React from "react"

import { useState, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import {
  Send,
  Upload,
  Settings,
  MessageSquare,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react"

interface SMSResult {
  phone: string
  status: "success" | "error" | "pending"
  message?: string
  timestamp: Date
  quotaRemaining?: number
}

interface SMSConfig {
  apiKey: string
  fromName: string
  sendingSpeed: number
  maxRetries: number
  batchSize: number
}

export default function SMSMailer() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Configuration state with improved defaults
  const [config, setConfig] = useState<SMSConfig>({
    apiKey: "659c13cf403cdc875a57940ce379289e4d65a6e1XuxtcjGE32ggiY1DGYH2rOBoQ",
    fromName: "",
    sendingSpeed: 1000,
    maxRetries: 2,
    batchSize: 10,
  })

  // Single SMS state
  const [singlePhone, setSinglePhone] = useState("")
  const [singleMessage, setSingleMessage] = useState("")

  // Bulk SMS state
  const [bulkPhones, setBulkPhones] = useState("")
  const [bulkMessage, setBulkMessage] = useState("")
  const [phoneList, setPhoneList] = useState<string[]>([])

  // Sending state with enhanced controls
  const [isSending, setIsSending] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [sendingProgress, setSendingProgress] = useState(0)
  const [results, setResults] = useState<SMSResult[]>([])
  const [currentlySending, setCurrentlySending] = useState("")
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null)

  const parsePhoneNumbers = useCallback((text: string): string[] => {
    // Multiple regex patterns for better phone number detection
    const patterns = [
      /(\+?1?[-.\s]?)?$$?([0-9]{3})$$?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g, // Fixed regex
      /(\+?1[-.\s]?)?([0-9]{3})[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
      /([0-9]{10})/g, // Simple 10-digit numbers
    ]

    const phoneSet = new Set<string>()

    patterns.forEach((pattern) => {
      const matches = text.match(pattern) || []
      matches.forEach((phone) => {
        // Clean and normalize phone number
        const cleaned = phone.replace(/\D/g, "")
        if (cleaned.length === 11 && cleaned.startsWith("1")) {
          phoneSet.add(cleaned.substring(1))
        } else if (cleaned.length === 10) {
          phoneSet.add(cleaned)
        }
      })
    })

    return Array.from(phoneSet)
  }, [])

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 5MB",
          variant: "destructive",
        })
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          let phones: string[] = []

          if (file.name.endsWith(".csv")) {
            // Parse CSV - look for phone numbers in any column
            const lines = content.split("\n")
            const allText = lines.join(" ")
            phones = parsePhoneNumbers(allText)
          } else {
            phones = parsePhoneNumbers(content)
          }

          if (phones.length === 0) {
            toast({
              title: "No phone numbers found",
              description: "Please check your file format and try again",
              variant: "destructive",
            })
            return
          }

          setPhoneList(phones)
          setBulkPhones(phones.join("\n"))
          toast({
            title: "File uploaded successfully",
            description: `Found ${phones.length} valid phone numbers`,
          })
        } catch (error) {
          toast({
            title: "Error reading file",
            description: "Please check your file format and try again",
            variant: "destructive",
          })
        }
      }
      reader.readAsText(file)
    },
    [parsePhoneNumbers, toast],
  )

  const handleBulkPhonesChange = useCallback(
    (value: string) => {
      setBulkPhones(value)
      const phones = parsePhoneNumbers(value)
      setPhoneList(phones)
    },
    [parsePhoneNumbers],
  )

  const sendSMSRequest = async (phone: string, message: string, retryCount = 0): Promise<SMSResult> => {
    try {
      const finalMessage = config.fromName ? `${config.fromName}: ${message}` : message

      const response = await fetch("https://textbelt.com/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone,
          message: finalMessage,
          key: config.apiKey,
        }),
        signal: abortControllerRef.current?.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Update quota information
      if (data.quotaRemaining !== undefined) {
        setQuotaRemaining(data.quotaRemaining)
      }

      return {
        phone,
        status: data.success ? "success" : "error",
        message: data.success ? "Message sent successfully" : data.error || "Unknown error",
        timestamp: new Date(),
        quotaRemaining: data.quotaRemaining,
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        return {
          phone,
          status: "error",
          message: "Sending cancelled",
          timestamp: new Date(),
        }
      }

      // Retry logic for network errors
      if (retryCount < config.maxRetries && !error.message.includes("HTTP")) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)))
        return sendSMSRequest(phone, message, retryCount + 1)
      }

      return {
        phone,
        status: "error",
        message: error.message || "Network error occurred",
        timestamp: new Date(),
      }
    }
  }

  const sendSingleSMS = async () => {
    const cleanPhone = singlePhone.replace(/\D/g, "")

    if (!cleanPhone || cleanPhone.length < 10) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive",
      })
      return
    }

    if (!singleMessage.trim()) {
      toast({
        title: "Missing message",
        description: "Please enter a message to send",
        variant: "destructive",
      })
      return
    }

    if (singleMessage.length > 160) {
      toast({
        title: "Message too long",
        description: "SMS messages should be 160 characters or less",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    setResults([])
    abortControllerRef.current = new AbortController()

    const result = await sendSMSRequest(cleanPhone, singleMessage)
    setResults([result])

    toast({
      title: result.status === "success" ? "Message sent!" : "Failed to send",
      description: result.status === "success" ? `SMS sent to ${cleanPhone}` : result.message,
      variant: result.status === "success" ? "default" : "destructive",
    })

    setIsSending(false)
  }

  const sendBulkSMS = async () => {
    if (phoneList.length === 0) {
      toast({
        title: "No phone numbers",
        description: "Please enter phone numbers to send to",
        variant: "destructive",
      })
      return
    }

    if (!bulkMessage.trim()) {
      toast({
        title: "Missing message",
        description: "Please enter a message to send",
        variant: "destructive",
      })
      return
    }

    if (bulkMessage.length > 160) {
      toast({
        title: "Message too long",
        description: "SMS messages should be 160 characters or less",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    setIsPaused(false)
    setResults([])
    setSendingProgress(0)
    abortControllerRef.current = new AbortController()

    const newResults: SMSResult[] = []

    try {
      for (let i = 0; i < phoneList.length; i++) {
        // Check for pause
        while (isPaused && !abortControllerRef.current?.signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        if (abortControllerRef.current?.signal.aborted) break

        const phone = phoneList[i]
        setCurrentlySending(phone)

        const result = await sendSMSRequest(phone, bulkMessage)
        newResults.push(result)
        setResults([...newResults])

        setSendingProgress(((i + 1) / phoneList.length) * 100)

        // Rate limiting with adaptive delay
        if (i < phoneList.length - 1) {
          const delay = result.status === "error" ? config.sendingSpeed * 2 : config.sendingSpeed
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    } catch (error) {
      console.error("Bulk sending error:", error)
    }

    setCurrentlySending("")
    setIsSending(false)
    setIsPaused(false)

    const successCount = newResults.filter((r) => r.status === "success").length
    toast({
      title: "Bulk sending complete",
      description: `${successCount}/${phoneList.length} messages sent successfully`,
    })
  }

  const togglePause = () => {
    setIsPaused(!isPaused)
  }

  const stopSending = () => {
    abortControllerRef.current?.abort()
    setIsSending(false)
    setIsPaused(false)
    setCurrentlySending("")
  }

  const updateConfig = (updates: Partial<SMSConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }))
  }

  const statistics = useMemo(() => {
    const total = results.length
    const success = results.filter((r) => r.status === "success").length
    const failed = results.filter((r) => r.status === "error").length
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0

    return { total, success, failed, successRate }
  }, [results])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800 border-green-200"
      case "error":
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">SMS Mailer Pro</h1>
          <p className="text-lg text-gray-600">Professional SMS marketing and communication platform</p>
          {quotaRemaining !== null && (
            <Badge variant="outline" className="mt-2">
              Quota Remaining: {quotaRemaining}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="single" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Single SMS
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Bulk SMS
            </TabsTrigger>
            <TabsTrigger value="api" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              API
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Results ({statistics.total})
            </TabsTrigger>
          </TabsList>

          {/* Single SMS Tab */}
          <TabsContent value="single">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Send Single SMS
                </CardTitle>
                <CardDescription>Send an SMS message to a single phone number</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="single-phone">Phone Number</Label>
                    <Input
                      id="single-phone"
                      placeholder="e.g., 5555555555 or +1-555-555-5555"
                      value={singlePhone}
                      onChange={(e) => setSinglePhone(e.target.value)}
                    />
                    {singlePhone && (
                      <div className="text-sm">
                        {parsePhoneNumbers(singlePhone).length > 0 ? (
                          <span className="text-green-600">✓ Valid phone number</span>
                        ) : (
                          <span className="text-red-600">✗ Invalid phone number format</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="p-3 bg-gray-50 rounded-md text-sm min-h-[60px]">
                      {config.fromName && <span className="font-medium">{config.fromName}: </span>}
                      {singleMessage || "Your message will appear here..."}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="single-message">Message</Label>
                  <Textarea
                    id="single-message"
                    placeholder="Enter your message here..."
                    value={singleMessage}
                    onChange={(e) => setSingleMessage(e.target.value)}
                    rows={4}
                  />
                  <div className="flex justify-between text-sm">
                    <span className={singleMessage.length > 160 ? "text-red-600" : "text-gray-500"}>
                      {singleMessage.length}/160 characters
                    </span>
                    {singleMessage.length > 160 && <span className="text-red-600">Message too long for SMS</span>}
                  </div>
                </div>

                <Button
                  onClick={sendSingleSMS}
                  disabled={isSending || !singlePhone || !singleMessage || singleMessage.length > 160}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSending ? "Sending..." : "Send SMS"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bulk SMS Tab */}
          <TabsContent value="bulk">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Send Bulk SMS
                </CardTitle>
                <CardDescription>Send SMS messages to multiple phone numbers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bulk-phones">Phone Numbers</Label>
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload File
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                    <Textarea
                      id="bulk-phones"
                      placeholder="Enter phone numbers (one per line or comma-separated)&#10;5555555555&#10;+1-555-555-5556&#10;555.555.5557"
                      value={bulkPhones}
                      onChange={(e) => handleBulkPhonesChange(e.target.value)}
                      rows={8}
                    />
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>{phoneList.length} phone numbers detected</span>
                      {phoneList.length > 0 && <Badge variant="secondary">{phoneList.length} recipients</Badge>}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label htmlFor="bulk-message">Message</Label>
                    <Textarea
                      id="bulk-message"
                      placeholder="Enter your bulk message here..."
                      value={bulkMessage}
                      onChange={(e) => setBulkMessage(e.target.value)}
                      rows={8}
                    />
                    <div className="flex justify-between text-sm">
                      <span className={bulkMessage.length > 160 ? "text-red-600" : "text-gray-500"}>
                        {bulkMessage.length}/160 characters
                      </span>
                      {bulkMessage.length > 160 && <span className="text-red-600">Message too long for SMS</span>}
                    </div>

                    <div className="p-3 bg-gray-50 rounded-md">
                      <Label className="text-sm font-medium">Preview:</Label>
                      <div className="text-sm mt-1">
                        {config.fromName && <span className="font-medium">{config.fromName}: </span>}
                        {bulkMessage || "Your message will appear here..."}
                      </div>
                    </div>
                  </div>
                </div>

                {isSending && (
                  <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Sending progress...</span>
                        {isPaused && <Badge variant="secondary">Paused</Badge>}
                      </div>
                      <span className="text-sm font-medium">{Math.round(sendingProgress)}%</span>
                    </div>
                    <Progress value={sendingProgress} className="w-full" />
                    {currentlySending && (
                      <div className="text-sm text-gray-600">Currently sending to: {currentlySending}</div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={togglePause}>
                        {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        {isPaused ? "Resume" : "Pause"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={stopSending}>
                        <XCircle className="h-4 w-4" />
                        Stop
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  onClick={sendBulkSMS}
                  disabled={isSending || phoneList.length === 0 || !bulkMessage || bulkMessage.length > 160}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSending
                    ? `Sending... (${Math.round(sendingProgress)}%)`
                    : `Send to ${phoneList.length} Recipients`}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Tab */}
          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  API Configuration
                </CardTitle>
                <CardDescription>Configure your API settings and message preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Enter your API key"
                    value={config.apiKey}
                    onChange={(e) => updateConfig({ apiKey: e.target.value })}
                  />
                  <div className="text-sm text-gray-500">
                    Enter your TextBelt-compatible API key for sending SMS messages
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="from-name">Sender Name</Label>
                  <Input
                    id="from-name"
                    placeholder="e.g., Charles, Tokyo, Figherzing"
                    value={config.fromName}
                    onChange={(e) => updateConfig({ fromName: e.target.value })}
                    maxLength={15}
                  />
                  <div className="text-sm text-gray-500">
                    Recipients will see this name as the sender. This will appear as "YourName: Your message"
                  </div>
                  {config.fromName && (
                    <div className="p-2 bg-blue-50 rounded text-sm">
                      <strong>Preview:</strong> {config.fromName}: Hello, this is a test message
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sending-speed">Sending Speed (Bulk SMS)</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="sending-speed"
                        type="number"
                        min="500"
                        max="10000"
                        step="100"
                        value={config.sendingSpeed}
                        onChange={(e) => updateConfig({ sendingSpeed: Number(e.target.value) })}
                        className="w-32"
                      />
                      <span className="text-sm text-gray-500">milliseconds between sends</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      <span className="text-gray-500">
                        Current rate: {Math.round(60000 / config.sendingSpeed)} messages per minute
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-retries">Max Retries per Message</Label>
                    <Input
                      id="max-retries"
                      type="number"
                      min="0"
                      max="5"
                      value={config.maxRetries}
                      onChange={(e) => updateConfig({ maxRetries: Number(e.target.value) })}
                      className="w-32"
                    />
                    <div className="text-sm text-gray-500">Number of retry attempts for failed messages</div>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Rate Limiting:</strong> Adjust sending speed to comply with API rate limits and avoid being
                    blocked. Slower speeds are recommended for large bulk sends.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Sending Results
                </CardTitle>
                <CardDescription>View the results of your SMS campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                {results.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No results yet. Send some messages to see results here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{statistics.total}</div>
                        <div className="text-sm text-gray-600">Total Sent</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{statistics.success}</div>
                        <div className="text-sm text-gray-600">Successful</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{statistics.failed}</div>
                        <div className="text-sm text-gray-600">Failed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{statistics.successRate}%</div>
                        <div className="text-sm text-gray-600">Success Rate</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setResults([])}>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Clear Results
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {results.map((result, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(result.status)}
                            <div>
                              <div className="font-medium">{result.phone}</div>
                              <div className="text-sm text-gray-500">{result.timestamp.toLocaleTimeString()}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(result.status)}>{result.status}</Badge>
                            {result.message && <div className="text-sm text-gray-500 mt-1">{result.message}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
