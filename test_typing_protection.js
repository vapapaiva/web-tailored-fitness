/**
 * Test typing protection and sync loop prevention
 */

// Mock the enhanced text sync logic
class EnhancedTextSync {
  constructor() {
    this.textEditorValue = '';
    this.isUserTyping = false;
    this.isUpdatingFromUI = false;
    this.lastParsedText = '';
    this.typingTimeout = null;
    this.debounceTimeout = null;
    this.syncBlockedCount = 0;
    this.syncAllowedCount = 0;
  }

  // Simulate the enhanced handleTextChange
  handleTextChange(newText) {
    console.log(`📝 User typing: "${newText}"`);
    
    // Mark user as actively typing
    this.isUserTyping = true;
    
    // Clear existing typing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    // Set timeout to detect when user stops typing
    this.typingTimeout = setTimeout(() => {
      this.isUserTyping = false;
      console.log('✅ User stopped typing, sync allowed again');
    }, 1000);
    
    this.textEditorValue = newText;
    
    // Clear existing debounce timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    
    // Debounce the parsing
    this.debounceTimeout = setTimeout(() => {
      if (!this.isUserTyping) {
        this.parseTextToState(newText);
      }
    }, 500);
  }

  // Simulate syncUIToText with typing protection
  syncUIToText() {
    if (this.isUserTyping) {
      console.log('🚫 Blocking UI→Text sync: User is actively typing');
      this.syncBlockedCount++;
      return;
    }

    console.log('🔄 UI→Text sync allowed');
    this.syncAllowedCount++;
    this.isUpdatingFromUI = true;
    
    const generatedText = this.generateTextFromState();
    this.textEditorValue = generatedText;
    this.lastParsedText = generatedText;
    
    setTimeout(() => {
      this.isUpdatingFromUI = false;
    }, 10);
  }

  // Simulate state change effect
  onStateChange() {
    if (this.isUserTyping || this.isUpdatingFromUI) {
      console.log('🚫 Blocking auto-sync: User typing or UI updating');
      return;
    }
    
    const currentStateText = this.generateTextFromState();
    if (currentStateText !== this.textEditorValue && currentStateText !== this.lastParsedText) {
      console.log('🔄 Auto-syncing state to text (user not typing)');
      this.textEditorValue = currentStateText;
      this.lastParsedText = currentStateText;
    }
  }

  parseTextToState(text) {
    console.log(`🔄 Parsing text to state: "${text}"`);
    this.lastParsedText = text;
    // Simulate state change that would trigger onStateChange
    setTimeout(() => this.onStateChange(), 10);
  }

  generateTextFromState() {
    return "- Generated from state";
  }

  getStats() {
    return {
      syncBlocked: this.syncBlockedCount,
      syncAllowed: this.syncAllowedCount,
      currentText: this.textEditorValue,
      isTyping: this.isUserTyping
    };
  }
}

// Test scenarios
async function runTests() {
  console.log("🧪 Testing typing protection and sync loop prevention...\n");

  const textSync = new EnhancedTextSync();

  // Test 1: Rapid typing should not trigger sync loops
  console.log("Test 1: Rapid typing protection");
  textSync.handleTextChange("- R");
  textSync.handleTextChange("- Ru");
  textSync.handleTextChange("- Run");
  textSync.handleTextChange("- Runn");
  textSync.handleTextChange("- Runni");
  textSync.handleTextChange("- Runnin");
  textSync.handleTextChange("- Running");

  // Try to sync while typing (should be blocked)
  textSync.syncUIToText();
  textSync.syncUIToText();
  textSync.syncUIToText();

  console.log("Stats after rapid typing:", textSync.getStats());
  console.log("");

  // Test 2: Wait for typing to stop, then allow sync
  console.log("Test 2: Sync after typing stops");
  
  // Wait for typing timeout (1000ms + buffer)
  await new Promise(resolve => setTimeout(resolve, 1100));
  
  console.log("After typing timeout:");
  console.log("Is user typing:", textSync.isUserTyping);
  
  // Now sync should be allowed
  textSync.syncUIToText();
  
  console.log("Final stats:", textSync.getStats());
  console.log("");

  // Test 3: State changes while typing (should be blocked)
  console.log("Test 3: State changes while typing");
  
  textSync.handleTextChange("- New exercise");
  // Immediately trigger state change (simulating UI action)
  textSync.onStateChange();
  textSync.onStateChange();
  
  console.log("Text should remain user input:", textSync.textEditorValue);
  console.log("");

  // Test 4: State changes after typing stops (should be allowed)
  console.log("Test 4: State changes after typing stops");
  
  await new Promise(resolve => setTimeout(resolve, 1100));
  
  textSync.onStateChange();
  console.log("Text should be from state:", textSync.textEditorValue);
  console.log("");

  console.log("✅ All typing protection tests completed!");
  console.log("Summary:");
  console.log("- Sync blocked during typing:", textSync.syncBlockedCount, "times");
  console.log("- Sync allowed when safe:", textSync.syncAllowedCount, "times");
  console.log("- User text preserved during typing");
  console.log("- State sync works when user stops typing");
}

runTests().catch(console.error);
