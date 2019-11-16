export interface Options {
  circular?: boolean
}

export class DepGraphCycleError extends Error {
  constructor(cyclePath: string[]) {
    super(
      "Dependency Cycle Found: " + cyclePath.join(" -> ")
    )
  }
}

export class DepGraph<T> {
  nodes: Record<string, T | string>
  outgoingEdges: Record<string, (T | string)[]>
  incomingEdges: Record<string, (T | string)[]>
  circular: boolean

  /**
   * Creates an instance of DepGraph with optional Options.
   */
  constructor(opts?: Options) {
    this.nodes = {} // Node -> Node/Data (treated like a Set)
    this.outgoingEdges = {} // Node -> [Dependency Node]
    this.incomingEdges = {} // Node -> [Dependant Node]
    this.circular = opts && !!opts.circular // Allows circular deps
  }

  /**
   * Helper for creating a Depth-First-Search on
   * a set of edges.
   *
   * Detects cycles and throws an Error if one is detected.
   *
   * @param edges The set of edges to DFS through
   * @param leavesOnly Whether to only return "leaf" nodes (ones who have no edges)
   * @param result An array in which the results will be populated
   * @param circular A boolean to allow circular dependencies
   */
  createDFS(
    edges: Record<any, (T | string)[]>,
    leavesOnly: boolean,
    result: (T | string)[],
    circular: boolean
  ): Function {
    const currentPath = []
    const visited: Record<any, boolean> = {}

    return function DFS(currentNode: any): void {
      visited[currentNode] = true
      currentPath.push(currentNode)
      edges[currentNode].forEach(function(node) {
        if (!visited[node]) {
          DFS(node)
        } else if (currentPath.indexOf(node) >= 0) {
          currentPath.push(node)
          if (!circular) {
            // eslint-disable-next-line
            // @ts-ignore
            throw new DepGraphCycleError(currentPath)
          }
        }
      })
      currentPath.pop()
      if (
        (!leavesOnly || edges[currentNode].length === 0) &&
        result.indexOf(currentNode) === -1
      ) {
        result.push(currentNode)
      }
    }
  }

  /**
   * The number of nodes in the graph.
   */
  size(): number {
    return Object.keys(this.nodes).length
  }

  /**
   * Add a node in the graph with optional data. If data is not given, name will be used as data.
   * @param {string} node
   * @param data
   */
  addNode(node: string, data?: T): void {
    if (!this.hasNode(node)) {
      // Checking the arguments length allows the user to add a node with undefined data
      if (arguments.length === 2) {
        this.nodes[node] = data
      } else {
        this.nodes[node] = node
      }
      this.outgoingEdges[node] = []
      this.incomingEdges[node] = []
    }
  }

  /**
   * Remove a node from the graph.
   * @param {string} node
   */
  removeNode(node: string): void {
    if (this.hasNode(node)) {
      delete this.nodes[node]
      delete this.outgoingEdges[node]
      delete this.incomingEdges[node]
      ;[this.incomingEdges, this.outgoingEdges].forEach(
        function(edgeList) {
          Object.keys(edgeList).forEach(function(key) {
            const idx = edgeList[key].indexOf(node)
            if (idx >= 0) {
              edgeList[key].splice(idx, 1)
            }
          }, this)
        }
      )
    }
  }

  /**
   * Check if a node exists in the graph.
   * @param {string} node
   */
  hasNode(node: string): boolean {
    return this.nodes.hasOwnProperty(node)
  }

  /**
   * Get the data associated with a node (will throw an Error if the node does not exist).
   * @param {string} node
   */
  getNodeData(node: string): T | string {
    if (this.hasNode(node)) {
      return this.nodes[node]
    } else {
      throw new Error("Node does not exist: " + node)
    }
  }

  /**
   * Set the data for an existing node (will throw an Error if the node does not exist).
   * @param {string} node
   * @param data
   */
  setNodeData(node: string, data?: T): void {
    if (this.hasNode(node)) {
      this.nodes[node] = data
    } else {
      throw new Error("Node does not exist: " + node)
    }
  }

  /**
   * Add a dependency between two nodes (will throw an Error if one of the nodes does not exist).
   * @param {string} from
   * @param {string} to
   */
  addDependency(from: string, to: string): void {
    if (!this.hasNode(from)) {
      throw new Error("Node does not exist: " + from)
    }
    if (!this.hasNode(to)) {
      throw new Error("Node does not exist: " + to)
    }
    if (this.outgoingEdges[from].indexOf(to) === -1) {
      this.outgoingEdges[from].push(to)
    }
    if (this.incomingEdges[to].indexOf(from) === -1) {
      this.incomingEdges[to].push(from)
    }
  }

  /**
   * Remove a dependency between two nodes.
   * @param {string} from
   * @param {string} to
   */
  removeDependency(from: string, to: string): void {
    let idx: number
    if (this.hasNode(from)) {
      idx = this.outgoingEdges[from].indexOf(to)
      if (idx >= 0) {
        this.outgoingEdges[from].splice(idx, 1)
      }
    }

    if (this.hasNode(to)) {
      idx = this.incomingEdges[to].indexOf(from)
      if (idx >= 0) {
        this.incomingEdges[to].splice(idx, 1)
      }
    }
  }

  /**
   * Return a clone of the dependency graph (If any custom data is attached
   * to the nodes, it will only be shallow copied).
   */
  clone(): DepGraph<T> {
    const result = new DepGraph<T>()
    const keys = Object.keys(this.nodes)
    keys.forEach(n => {
      result.nodes[n] = this.nodes[n]
      result.outgoingEdges[n] = this.outgoingEdges[n].slice(
        0
      )
      result.incomingEdges[n] = this.incomingEdges[n].slice(
        0
      )
    })
    return result
  }

  /**
   * Get an array containing the nodes that the specified node depends on (transitively). If leavesOnly is true, only nodes that do not depend on any other nodes will be returned in the array.
   * @param {string} node
   * @param {boolean} leavesOnly
   */
  dependenciesOf(
    node: string,
    leavesOnly?: boolean
  ): string[] {
    if (this.hasNode(node)) {
      const result = []
      const DFS = this.createDFS(
        this.outgoingEdges,
        leavesOnly,
        result,
        this.circular
      )
      DFS(node)
      const idx = result.indexOf(node)
      if (idx >= 0) {
        result.splice(idx, 1)
      }
      return result
    } else {
      throw new Error("Node does not exist: " + node)
    }
  }

  /**
   * Get an array containing the nodes that depend on the specified node (transitively). If leavesOnly is true, only nodes that do not have any dependants will be returned in the array.
   * @param {string} node
   * @param {boolean} leavesOnly
   */
  dependantsOf(
    node: string,
    leavesOnly?: boolean
  ): string[] {
    if (this.hasNode(node)) {
      const result = []
      const DFS = this.createDFS(
        this.incomingEdges,
        leavesOnly,
        result,
        this.circular
      )
      DFS(node)
      const idx = result.indexOf(node)
      if (idx >= 0) {
        result.splice(idx, 1)
      }
      return result
    } else {
      throw new Error("Node does not exist: " + node)
    }
  }

  /**
   * Construct the overall processing order for the dependency graph. If leavesOnly is true, only nodes that do not depend on any other nodes will be returned.
   * @param {boolean} leavesOnly
   */
  overallOrder(leavesOnly?: boolean): string[] {
    const result = []
    const keys = Object.keys(this.nodes)
    if (keys.length === 0) {
      return result // Empty graph
    } else {
      // Look for cycles - we run the DFS starting at all the nodes in case there
      // are several disconnected subgraphs inside this dependency graph.
      const CycleDFS = this.createDFS(
        this.outgoingEdges,
        false,
        [],
        this.circular
      )
      keys.forEach(function(n) {
        CycleDFS(n)
      })

      const DFS = this.createDFS(
        this.outgoingEdges,
        leavesOnly,
        result,
        this.circular
      )
      // Find all potential starting points (nodes with nothing depending on them) an
      // run a DFS starting at these points to get the order
      keys
        .filter(node => {
          return this.incomingEdges[node].length === 0
        })
        .forEach(function(n) {
          DFS(n)
        })

      return result
    }
  }
}
