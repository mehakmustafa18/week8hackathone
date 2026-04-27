/**
 * AGENT RUNNER
 * 
 * Orchestrates the execution flow:
 * User Input → Router → Specialized Agent → Response
 * 
 * Features:
 * - Tracing of agent execution
 * - Error handling
 * - Guardrail enforcement
 */

import { RouterAgent } from './router.agent';
import { DocumentAnalyzerAgent } from './analyzer.agent';
import { SummarizerAgent } from './summarizer.agent';
import { QAAgent } from './qa.agent';
import { guardrailEngine } from './guardrails';

export interface ExecutionTrace {
  requestId: string;
  userQuery: string;
  timestamp: Date;
  routing: {
    routerDecision: any;
    targetAgent: string;
    routingReasoning: string;
  };
  execution: {
    agentType: string;
    toolsUsed: string[];
    executionTime: number;
    success: boolean;
  };
  response: any;
  guardrailChecks: Array<{
    checkType: string;
    passed: boolean;
    reason?: string;
  }>;
}

export class AgentRunner {
  private routerAgent: RouterAgent;
  private analyzerAgent: DocumentAnalyzerAgent;
  private summarizerAgent: SummarizerAgent;
  private qaAgent: QAAgent;
  private enableTracing: boolean;
  private traces: ExecutionTrace[] = [];

  constructor(enableTracing = true) {
    this.routerAgent = new RouterAgent();
    this.analyzerAgent = new DocumentAnalyzerAgent();
    this.summarizerAgent = new SummarizerAgent();
    this.qaAgent = new QAAgent();
    this.enableTracing = enableTracing;
  }

  /**
   * Main execution pipeline
   */
  async executeQuery(
    userQuery: string,
    documentTitle: string,
    documentPath: string,
    documentContent: string,
  ): Promise<{
    response: any;
    trace?: ExecutionTrace;
  }> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    const trace: ExecutionTrace = {
      requestId,
      userQuery,
      timestamp: new Date(),
      routing: { routerDecision: null, targetAgent: '', routingReasoning: '' },
      execution: { agentType: '', toolsUsed: [], executionTime: 0, success: false },
      response: null,
      guardrailChecks: [],
    };

    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`[RUNNER] New request: ${requestId}`);
      console.log(`[RUNNER] Query: ${userQuery}`);
      console.log(`[RUNNER] Document: ${documentTitle}`);
      console.log(`[RUNNER] Content length: ${documentContent?.length || 0} chars`);
      console.log(`${'='.repeat(60)}\n`);

      // Validate document content
      if (!documentContent || documentContent.trim().length === 0) {
        throw new Error('Document content is empty or not available');
      }

      // STEP 1: ROUTING
      console.log('[RUNNER] STEP 1: Router Agent');
      console.log('─'.repeat(40));

      const routerDecision = await this.routerAgent.route(userQuery, documentTitle);

      trace.routing = {
        routerDecision,
        targetAgent: routerDecision.targetAgent,
        routingReasoning: routerDecision.reasoning,
      };

      console.log(`[RUNNER] → Target Agent: ${routerDecision.targetAgent}`);
      console.log(`[RUNNER] → Confidence: ${(routerDecision.confidence * 100).toFixed(0)}%`);
      console.log(`[RUNNER] → Reasoning: ${routerDecision.reasoning}`);

      // STEP 2: EXECUTE SPECIALIZED AGENT
      console.log(`\n[RUNNER] STEP 2: ${routerDecision.targetAgent.toUpperCase()} Agent`);
      console.log('─'.repeat(40));

      let agentResponse: any;
      const agentStartTime = Date.now();

      switch (routerDecision.targetAgent) {
        case 'analyzer':
          agentResponse = await this.analyzerAgent.analyze(documentContent, documentTitle);
          break;

        case 'summarizer':
          agentResponse = await this.summarizerAgent.summarize(
            documentContent,
            'general',
            documentTitle,
          );
          break;

        case 'qa':
          await this.qaAgent.setDocumentContent(documentContent);
          agentResponse = await this.qaAgent.answer(userQuery);
          break;

        default:
          throw new Error(`Unknown agent: ${routerDecision.targetAgent}`);
      }

      const executionTime = Date.now() - agentStartTime;

      trace.execution = {
        agentType: routerDecision.targetAgent,
        toolsUsed: agentResponse.toolsUsed || [],
        executionTime,
        success: true,
      };

      console.log(`[RUNNER] ✓ Execution successful`);
      console.log(`[RUNNER] → Tools used: ${(agentResponse.toolsUsed || []).join(', ')}`);
      console.log(`[RUNNER] → Execution time: ${executionTime}ms`);

      // STEP 3: GUARDRAIL CHECKS
      console.log(`\n[RUNNER] STEP 3: Guardrail Validation`);
      console.log('─'.repeat(40));

      if (routerDecision.targetAgent === 'qa') {
        const guardrailResults = guardrailEngine.runAllChecks(
          userQuery,
          agentResponse.answer,
          'qa',
          agentResponse.toolsUsed || [],
          documentContent,
          agentResponse.sources ? agentResponse.sources.map((s: any) => s.excerpt) : [],
        );

        trace.guardrailChecks = guardrailResults.failures.map((f) => ({
          checkType: f.reason || 'Unknown',
          passed: f.passed,
          reason: f.reason,
        }));

        if (!guardrailResults.passed) {
          console.log('[RUNNER] ⚠ Guardrail failures detected:');
          guardrailResults.failures.forEach((f) => {
            console.log(`  - ${f.reason}`);
          });
        } else {
          console.log('[RUNNER] ✓ All guardrails passed');
        }
      }

      // STEP 4: FORMAT RESPONSE
      console.log(`\n[RUNNER] STEP 4: Response Formatting`);
      console.log('─'.repeat(40));

      const finalResponse = {
        success: true,
        data: agentResponse,
        routing: {
          targetAgent: routerDecision.targetAgent,
          confidence: routerDecision.confidence,
        },
        executionTime: Date.now() - startTime,
        requestId,
      };

      console.log(`[RUNNER] ✓ Response ready`);
      console.log(`[RUNNER] Total execution time: ${finalResponse.executionTime}ms`);

      trace.response = finalResponse;

      // Store trace if enabled (Cap at 5 to prevent memory leaks)
      if (this.enableTracing) {
        this.traces.push(trace);
        if (this.traces.length > 5) {
          this.traces.shift();
        }
      }

      console.log(`[RUNNER] Heap Used: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
      console.log(`\n${'='.repeat(60)}\n`);

      return {
        response: finalResponse,
        trace: this.enableTracing ? trace : undefined,
      };
    } catch (error: any) {
      console.error(`[RUNNER] ✗ Error in execution: ${error.message}`);
      console.error(`[RUNNER] Error stack: ${error.stack}`);

      trace.execution.success = false;
      trace.response = { error: error.message };

      if (this.enableTracing) {
        this.traces.push(trace);
      }

      throw error;
    }
  }

  /**
   * Get execution traces for debugging
   */
  getTraces(limit = 10): ExecutionTrace[] {
    return this.traces.slice(-limit);
  }

  /**
   * Get trace by request ID
   */
  getTraceByRequestId(requestId: string): ExecutionTrace | undefined {
    return this.traces.find((t) => t.requestId === requestId);
  }

  /**
   * Clear traces
   */
  clearTraces(): void {
    this.traces = [];
  }

  /**
   * Print trace summary
   */
  printTraceSummary(trace: ExecutionTrace): void {
    console.log(`\n${'═'.repeat(60)}`);
    console.log('EXECUTION TRACE SUMMARY');
    console.log(`${'═'.repeat(60)}`);
    console.log(`Request ID: ${trace.requestId}`);
    console.log(`Query: ${trace.userQuery}`);
    console.log(`Target Agent: ${trace.routing.targetAgent}`);
    console.log(`Tools Used: ${trace.execution.toolsUsed.join(', ')}`);
    console.log(`Execution Time: ${trace.execution.executionTime}ms`);
    console.log(`Success: ${trace.execution.success}`);
    console.log(`${'═'.repeat(60)}\n`);
  }
}
