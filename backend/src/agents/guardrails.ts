/**
 * GUARDRAILS SYSTEM
 * Enforces document-grounded answers and blocks unsafe queries
 */

export interface GuardrailResult {
  passed: boolean;
  reason?: string;
  severity: 'critical' | 'warning' | 'info';
}

export class GuardrailEngine {
  /**
   * Check 1: Query Safety
   * Blocks queries unrelated to document analysis
   */
  checkQuerySafety(query: string): GuardrailResult {
    const unsafePatterns = [
      /write.*malware|hack|crack|exploit/i,
      /how to.*illegal|bypass.*security|circumvent/i,
      /generate.*code.*credit|money|exploit/i,
      /create.*virus|ransomware|botnet/i,
      /instructions.*harm|kill|attack|bomb/i,
    ];

    for (const pattern of unsafePatterns) {
      if (pattern.test(query)) {
        return {
          passed: false,
          reason: 'Query violates safety policies',
          severity: 'critical',
        };
      }
    }

    return { passed: true, severity: 'info' };
  }

  /**
   * Check 2: Answer Groundedness
   * Ensures answer is derived from document chunks
   */
  checkAnswerGroundedness(
    answer: string,
    documentChunks: string[],
    query: string,
  ): GuardrailResult {
    if (!documentChunks || documentChunks.length === 0) {
      return {
        passed: false,
        reason: 'No relevant document chunks found for query',
        severity: 'critical',
      };
    }

    // Check if answer references the document
    const documentKeywords = documentChunks.flatMap((chunk) => 
      chunk.split(/\s+/).filter((word) => word.length > 4)
    );

    const answerWords = answer.toLowerCase().split(/\s+/);
    const matchingWords = answerWords.filter((word) =>
      documentKeywords.some((dw) => dw.toLowerCase().includes(word) || word.includes(dw.toLowerCase()))
    );

    const groundednessScore = matchingWords.length / answerWords.length;

    if (groundednessScore < 0.3) {
      return {
        passed: false,
        reason: 'Answer lacks sufficient grounding in document (< 30% vocabulary overlap)',
        severity: 'critical',
      };
    }

    return { passed: true, severity: 'info' };
  }

  /**
   * Check 3: Hallucination Detection
   * Identifies suspicious claims that aren't in source
   */
  detectHallucinations(answer: string, documentContent: string): GuardrailResult {
    // Patterns that often indicate hallucinations
    const hallucIndicators = [
      /according to my knowledge(?!.*document)/i,
      /i recall(?!.*from.*document)/i,
      /in general|typically|usually(?!.*document)/i,
      /i'm not sure(?!.*document)(?!.*provided)/i,
    ];

    for (const pattern of hallucIndicators) {
      if (pattern.test(answer)) {
        return {
          passed: false,
          reason: 'Answer contains language suggesting hallucination',
          severity: 'warning',
        };
      }
    }

    // Check for specific claims not in document
    const answersNumbers = answer.match(/\d+/g) || [];

    // Verify each number exists natively within the source string without massive Array memory allocations
    for (const num of answersNumbers) {
      if (!documentContent.includes(num)) {
        return {
          passed: false,
          reason: `Answer contains specific number (${num}) not found in document`,
          severity: 'warning',
        };
      }
    }

    return { passed: true, severity: 'info' };
  }

  /**
   * Check 4: Tool Usage Validation
   * Ensures tools are used appropriately
   */
  validateToolUsage(
    agentType: string,
    toolsUsed: string[],
    purpose: string,
  ): GuardrailResult {
    // Router agent should NEVER use tools
    if (agentType === 'router' && toolsUsed.length > 0) {
      return {
        passed: false,
        reason: 'Router agent must not call tools - it only routes requests',
        severity: 'critical',
      };
    }

    // Q&A agent MUST use retrieval tools
    if (agentType === 'qa' && !toolsUsed.includes('retrieveChunks')) {
      return {
        passed: false,
        reason: 'Q&A agent must use chunk retrieval to ground answers',
        severity: 'critical',
      };
    }

    // Document analyzer should use analysis tools (not extraction - extraction is done by document service)
    if (agentType === 'analyzer' && toolsUsed.length === 0) {
      return {
        passed: false,
        reason: 'Document analyzer should use analysis tools like locateSections or extractEntities',
        severity: 'warning',
      };
    }

    return { passed: true, severity: 'info' };
  }

  /**
   * Check 5: Response Completeness
   * Ensures agent didn't skip important steps
   */
  validateResponseCompleteness(
    agentType: string,
    response: any,
  ): GuardrailResult {
    // Router must return routing decision
    if (agentType === 'router') {
      if (!response.targetAgent || !response.reasoning) {
        return {
          passed: false,
          reason: 'Router must provide targetAgent and reasoning',
          severity: 'critical',
        };
      }
    }

    // Q&A must return answer or "not found"
    if (agentType === 'qa') {
      if (!response.answer && !response.notFound) {
        return {
          passed: false,
          reason: 'Q&A agent must provide answer or explicitly state information is not available',
          severity: 'critical',
        };
      }

      if (response.answer && !response.sources) {
        return {
          passed: false,
          reason: 'Q&A answer must include source references',
          severity: 'warning',
        };
      }
    }

    return { passed: true, severity: 'info' };
  }

  /**
   * MAIN: Run all guardrails
   */
  runAllChecks(
    query: string,
    answer: string,
    agentType: string,
    toolsUsed: string[],
    documentContent: string,
    documentChunks: string[],
  ): { passed: boolean; failures: GuardrailResult[] } {
    const checks: GuardrailResult[] = [];

    checks.push(this.checkQuerySafety(query));

    if (agentType === 'qa') {
      checks.push(this.checkAnswerGroundedness(answer, documentChunks, query));
      checks.push(this.detectHallucinations(answer, documentContent));
    }

    checks.push(this.validateToolUsage(agentType, toolsUsed, query));

    const failures = checks.filter((c) => !c.passed);

    return {
      passed: failures.length === 0,
      failures,
    };
  }
}

export const guardrailEngine = new GuardrailEngine();
