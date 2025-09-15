class SMSMailer {
  constructor() {
    this.apiKey = "0d4df2d4b09bc20d801d3f16db7f5e6349670f03ibD6ucBas2yEYmmxOJkHlTifX"
    this.fromName = ""
    this.sendingSpeed = 1000
    this.phoneList = []
    this.results = []
    this.isSending = false

    this.initializeElements()
    this.bindEvents()
    this.loadSettings()
  }

  initializeElements() {
    // Tab elements
    this.tabButtons = document.querySelectorAll(".tab-button")
    this.tabContents = document.querySelectorAll(".tab-content")

    // Single SMS elements
    this.singlePhone = document.getElementById("single-phone")
    this.singleMessage = document.getElementById("single-message")
    this.singlePreview = document.getElementById("single-preview")
    this.singleCharCount = document.getElementById("single-char-count")
    this.sendSingleBtn = document.getElementById("send-single-btn")

    // Bulk SMS elements
    this.bulkPhones = document.getElementById("bulk-phones")
    this.bulkMessage = document.getElementById("bulk-message")
    this.bulkPreview = document.getElementById("bulk-preview")
    this.bulkCharCount = document.getElementById("bulk-char-count")
    this.phoneCountText = document.getElementById("phone-count-text")
    this.phoneCountBadge = document.getElementById("phone-count-badge")
    this.sendBulkBtn = document.getElementById("send-bulk-btn")
    this.uploadBtn = document.getElementById("upload-btn")
    this.fileInput = document.getElementById("file-input")

    // Progress elements
    this.progressContainer = document.getElementById("progress-container")
    this.progressFill = document.getElementById("progress-fill")
    this.progressPercent = document.getElementById("progress-percent")
    this.currentlySending = document.getElementById("currently-sending")

    // Settings elements
    this.apiKeyInput = document.getElementById("api-key")
    this.fromNameInput = document.getElementById("from-name")
    this.sendingSpeedInput = document.getElementById("sending-speed")
    this.rateInfo = document.getElementById("rate-info")

    // Results elements
    this.resultsContainer = document.getElementById("results-container")
    this.noResults = document.getElementById("no-results")

    // Toast container
    this.toastContainer = document.getElementById("toast-container")
  }

  bindEvents() {
    // Tab switching
    this.tabButtons.forEach((button) => {
      button.addEventListener("click", () => this.switchTab(button.dataset.tab))
    })

    // Single SMS events
    this.singleMessage.addEventListener("input", () => this.updateSinglePreview())
    this.sendSingleBtn.addEventListener("click", () => this.sendSingleSMS())

    // Bulk SMS events
    this.bulkPhones.addEventListener("input", () => this.updatePhoneList())
    this.bulkMessage.addEventListener("input", () => this.updateBulkPreview())
    this.sendBulkBtn.addEventListener("click", () => this.sendBulkSMS())
    this.uploadBtn.addEventListener("click", () => this.fileInput.click())
    this.fileInput.addEventListener("change", (e) => this.handleFileUpload(e))

    // Settings events
    this.apiKeyInput.addEventListener("input", () => this.updateSettings())
    this.fromNameInput.addEventListener("input", () => this.updateSettings())
    this.sendingSpeedInput.addEventListener("input", () => this.updateSendingSpeed())
  }

  switchTab(tabName) {
    // Update tab buttons
    this.tabButtons.forEach((btn) => btn.classList.remove("active"))
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active")

    // Update tab contents
    this.tabContents.forEach((content) => content.classList.remove("active"))
    document.getElementById(tabName).classList.add("active")
  }

  parsePhoneNumbers(text) {
    const phoneRegex = /(\+?1?[-.\s]?)?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})/g
    const matches = text.match(phoneRegex) || []
    return matches.map((phone) => phone.replace(/\D/g, "").replace(/^1/, ""))
  }

  updateSinglePreview() {
    const message = this.singleMessage.value
    const preview = this.fromName ? `${this.fromName}: ${message}` : message
    this.singlePreview.textContent = preview || "Your message will appear here..."
    this.singleCharCount.textContent = `${message.length}/160 characters`
  }

  updateBulkPreview() {
    const message = this.bulkMessage.value
    const preview = this.fromName ? `${this.fromName}: ${message}` : message
    this.bulkPreview.textContent = preview || "Your message will appear here..."
    this.bulkCharCount.textContent = `${message.length}/160 characters`
  }

  updatePhoneList() {
    const text = this.bulkPhones.value
    this.phoneList = this.parsePhoneNumbers(text)

    this.phoneCountText.textContent = `${this.phoneList.length} phone numbers detected`

    if (this.phoneList.length > 0) {
      this.phoneCountBadge.textContent = `${this.phoneList.length} recipients`
      this.phoneCountBadge.style.display = "inline"
      this.sendBulkBtn.innerHTML = `<i class="fas fa-paper-plane"></i> Send to ${this.phoneList.length} Recipients`
    } else {
      this.phoneCountBadge.style.display = "none"
      this.sendBulkBtn.innerHTML = `<i class="fas fa-paper-plane"></i> Send to 0 Recipients`
    }
  }

  updateSettings() {
    this.apiKey = this.apiKeyInput.value
    this.fromName = this.fromNameInput.value
    this.updateSinglePreview()
    this.updateBulkPreview()
    this.saveSettings()
  }

  updateSendingSpeed() {
    this.sendingSpeed = Number.parseInt(this.sendingSpeedInput.value)
    const rate = Math.round(60000 / this.sendingSpeed)
    this.rateInfo.textContent = `Current rate: ${rate} messages per minute`
    this.saveSettings()
  }

  handleFileUpload(event) {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result
      const phones = this.parsePhoneNumbers(content)
      this.phoneList = phones
      this.bulkPhones.value = phones.join("\n")
      this.updatePhoneList()
      this.showToast("File uploaded", `Found ${phones.length} phone numbers`, "success")
    }
    reader.readAsText(file)
  }

  async sendSingleSMS() {
    const phone = this.singlePhone.value.trim()
    const message = this.singleMessage.value.trim()

    if (!phone || !message) {
      this.showToast("Missing information", "Please enter both phone number and message", "error")
      return
    }

    this.isSending = true
    this.sendSingleBtn.disabled = true
    this.sendSingleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...'
    this.results = []

    try {
      const response = await fetch("https://textbelt.com/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone,
          message: this.fromName ? `${this.fromName}: ${message}` : message,
          key: this.apiKey,
        }),
      })

      const data = await response.json()

      const result = {
        phone: phone,
        status: data.success ? "success" : "error",
        message: data.success ? "Message sent successfully" : data.error || "Unknown error",
        timestamp: new Date(),
      }

      this.results = [result]
      this.updateResultsDisplay()

      this.showToast(
        data.success ? "Message sent!" : "Failed to send",
        data.success ? `SMS sent to ${phone}` : data.error,
        data.success ? "success" : "error",
      )
    } catch (error) {
      const result = {
        phone: phone,
        status: "error",
        message: "Network error occurred",
        timestamp: new Date(),
      }

      this.results = [result]
      this.updateResultsDisplay()

      this.showToast("Network error", "Failed to connect to TextBelt API", "error")
    }

    this.isSending = false
    this.sendSingleBtn.disabled = false
    this.sendSingleBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send SMS'
  }

  async sendBulkSMS() {
    if (this.phoneList.length === 0 || !this.bulkMessage.value.trim()) {
      this.showToast("Missing information", "Please enter phone numbers and message", "error")
      return
    }

    this.isSending = true
    this.sendBulkBtn.disabled = true
    this.results = []
    this.progressContainer.style.display = "block"
    this.progressFill.style.width = "0%"
    this.progressPercent.textContent = "0%"

    const message = this.bulkMessage.value.trim()
    const fullMessage = this.fromName ? `${this.fromName}: ${message}` : message

    for (let i = 0; i < this.phoneList.length; i++) {
      const phone = this.phoneList[i]
      this.currentlySending.textContent = `Currently sending to: ${phone}`

      try {
        const response = await fetch("https://textbelt.com/text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: phone,
            message: fullMessage,
            key: this.apiKey,
          }),
        })

        const data = await response.json()

        const result = {
          phone: phone,
          status: data.success ? "success" : "error",
          message: data.success ? "Message sent successfully" : data.error || "Unknown error",
          timestamp: new Date(),
        }

        this.results.push(result)
      } catch (error) {
        const result = {
          phone: phone,
          status: "error",
          message: "Network error occurred",
          timestamp: new Date(),
        }

        this.results.push(result)
      }

      const progress = ((i + 1) / this.phoneList.length) * 100
      this.progressFill.style.width = `${progress}%`
      this.progressPercent.textContent = `${Math.round(progress)}%`
      this.sendBulkBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Sending... (${Math.round(progress)}%)`

      this.updateResultsDisplay()

      // Wait between sends (rate limiting)
      if (i < this.phoneList.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, this.sendingSpeed))
      }
    }

    this.currentlySending.textContent = ""
    this.progressContainer.style.display = "none"
    this.isSending = false
    this.sendBulkBtn.disabled = false
    this.sendBulkBtn.innerHTML = `<i class="fas fa-paper-plane"></i> Send to ${this.phoneList.length} Recipients`

    const successCount = this.results.filter((r) => r.status === "success").length
    this.showToast(
      "Bulk sending complete",
      `${successCount}/${this.phoneList.length} messages sent successfully`,
      "success",
    )
  }

  updateResultsDisplay() {
    if (this.results.length === 0) {
      this.noResults.style.display = "block"
      return
    }

    this.noResults.style.display = "none"

    const successCount = this.results.filter((r) => r.status === "success").length
    const errorCount = this.results.filter((r) => r.status === "error").length

    const resultsHTML = `
            <div class="results-header">
                <div>Total: ${this.results.length} | Success: ${successCount} | Failed: ${errorCount}</div>
                <button class="btn btn-outline" onclick="smsMailer.clearResults()">Clear Results</button>
            </div>
            <div class="results-list">
                ${this.results
                  .map(
                    (result) => `
                    <div class="result-item">
                        <div class="result-left">
                            <i class="fas ${result.status === "success" ? "fa-check-circle" : "fa-times-circle"}" 
                               style="color: ${result.status === "success" ? "#10b981" : "#ef4444"}"></i>
                            <div>
                                <div class="result-phone">${result.phone}</div>
                                <div class="result-time">${result.timestamp.toLocaleTimeString()}</div>
                            </div>
                        </div>
                        <div class="result-right">
                            <div class="result-status ${result.status}">${result.status}</div>
                            ${result.message ? `<div class="result-message">${result.message}</div>` : ""}
                        </div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        `

    this.resultsContainer.innerHTML = resultsHTML
  }

  clearResults() {
    this.results = []
    this.noResults.style.display = "block"
    this.resultsContainer.innerHTML =
      '<div class="no-results" id="no-results"><i class="fas fa-comment fa-3x"></i><p>No results yet. Send some messages to see results here.</p></div>'
  }

  showToast(title, message, type = "success") {
    const toast = document.createElement("div")
    toast.className = `toast ${type}`
    toast.innerHTML = `
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        `

    this.toastContainer.appendChild(toast)

    setTimeout(() => {
      toast.remove()
    }, 5000)
  }

  saveSettings() {
    const settings = {
      apiKey: this.apiKey,
      fromName: this.fromName,
      sendingSpeed: this.sendingSpeed,
    }
    localStorage.setItem("smsMailerSettings", JSON.stringify(settings))
  }

  loadSettings() {
    const saved = localStorage.getItem("smsMailerSettings")
    if (saved) {
      const settings = JSON.parse(saved)
      this.apiKey = settings.apiKey || this.apiKey
      this.fromName = settings.fromName || ""
      this.sendingSpeed = settings.sendingSpeed || 1000

      this.apiKeyInput.value = this.apiKey
      this.fromNameInput.value = this.fromName
      this.sendingSpeedInput.value = this.sendingSpeed
      this.updateSendingSpeed()
    }
  }
}

// Initialize the SMS Mailer when the page loads
let smsMailer
document.addEventListener("DOMContentLoaded", () => {
  smsMailer = new SMSMailer()
})
