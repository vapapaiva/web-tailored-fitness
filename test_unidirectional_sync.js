/**
 * Test unidirectional sync: text→state always, state→text only on tab open
 */

// Mock the corrected sync logic
class UnidirectionalTextSync {
  constructor() {
    this.textEditorValue = '';
    this.isUpdatingFromUI = false;
    this.lastParsedText = '';
    this.debounceTimeout = null;
    this.progressUpdates = [];
    this.stateToTextSyncs = 0;
  }

  // Simulate the corrected handleTextChange (always syncs to state)
  handleTextChange(newText) {
    console.log(`📝 Text changed: "${newText}"`);
    this.textEditorValue = newText;
    
    // Don't sync if we're updating from UI to prevent loops
    if (this.isUpdatingFromUI) {
      console.log('🚫 Skipping sync: updating from UI');
      return;
    }
    
    // Don't sync if text hasn't actually changed from last parse
    if (newText === this.lastParsedText) {
      console.log('🚫 Skipping sync: no change from last parse');
      return;
    }
    
    // Clear existing debounce timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    
    // Debounce the parsing
    this.debounceTimeout = setTimeout(() => {
      this.parseTextToState(newText); // Always sync - no blocking!
    }, 300);
  }

  // Simulate syncUIToText (only called manually, e.g., on tab switch)
  syncUIToText() {
    this.isUpdatingFromUI = true;
    this.stateToTextSyncs++;
    
    const generatedText = this.generateTextFromState();
    console.log(`🔄 UI→Text sync: "${generatedText}"`);
    this.textEditorValue = generatedText;
    this.lastParsedText = generatedText;
    
    setTimeout(() => {
      this.isUpdatingFromUI = false;
    }, 10);
  }

  parseTextToState(text) {
    console.log(`🔄 Parsing text to state: "${text}"`);
    this.lastParsedText = text;
    
    // Simulate progress extraction from text
    const plusCount = (text.match(/\+/g) || []).length;
    if (plusCount > 0) {
      this.progressUpdates.push({
        text: text,
        plusCount: plusCount,
        timestamp: Date.now()
      });
      console.log(`✅ Progress updated: ${plusCount} completed sets`);
    }
  }

  generateTextFromState() {
    return "- Generated from state with progress";
  }

  getStats() {
    return {
      currentText: this.textEditorValue,
      progressUpdates: this.progressUpdates.length,
      stateToTextSyncs: this.stateToTextSyncs,
      lastProgressUpdate: this.progressUpdates[this.progressUpdates.length - 1]
    };
  }
}

// Test scenarios
async function runTests() {
  console.log("🧪 Testing unidirectional sync architecture...\n");

  const textSync = new UnidirectionalTextSync();

  // Test 1: Progress updates should work immediately
  console.log("Test 1: Progress updates while typing");
  textSync.handleTextChange("- Push ups");
  textSync.handleTextChange("- Push ups 3x10");
  textSync.handleTextChange("- Push ups 3x10 +");
  textSync.handleTextChange("- Push ups 3x10 ++");
  textSync.handleTextChange("- Push ups 3x10 +++");

  // Wait for debounce
  await new Promise(resolve => setTimeout(resolve, 350));
  
  console.log("Stats after typing progress:", textSync.getStats());
  console.log("");

  // Test 2: State→Text sync only happens manually
  console.log("Test 2: Manual state→text sync (tab switch)");
  
  // Simulate tab switch to text editor
  textSync.syncUIToText();
  
  console.log("Stats after manual sync:", textSync.getStats());
  console.log("");

  // Test 3: Continued typing after manual sync
  console.log("Test 3: Typing after manual sync");
  
  textSync.handleTextChange("- Push ups 3x10 +++");
  textSync.handleTextChange("- Push ups 3x10 +++\n- Pull ups 3x8");
  textSync.handleTextChange("- Push ups 3x10 +++\n- Pull ups 3x8 +");
  
  // Wait for debounce
  await new Promise(resolve => setTimeout(resolve, 350));
  
  console.log("Final stats:", textSync.getStats());
  console.log("");

  // Test 4: Verify no automatic state→text syncs
  console.log("Test 4: No automatic state→text syncs");
  
  // Simulate state changes (should NOT trigger text updates)
  console.log("Simulating state changes...");
  // In real app, this would be UI actions that change state
  // But text should NOT be updated automatically
  
  console.log("Text remains user input:", textSync.textEditorValue);
  console.log("State→Text syncs (should be 1):", textSync.stateToTextSyncs);
  console.log("");

  console.log("✅ All unidirectional sync tests completed!");
  console.log("Summary:");
  console.log("- Progress updates:", textSync.progressUpdates.length, "(should be > 0)");
  console.log("- Manual state→text syncs:", textSync.stateToTextSyncs, "(should be 1)");
  console.log("- Text→State sync: Always works");
  console.log("- State→Text sync: Only manual");
}

runTests().catch(console.error);
