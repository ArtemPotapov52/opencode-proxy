class Router {
  #index = 0;

  constructor(models, strategy = 'round-robin') {
    this.models = models;
    this.strategy = strategy;
  }

  next() {
    if (this.models.length === 0) return null;

    if (this.strategy === 'random') {
      return this.models[Math.floor(Math.random() * this.models.length)];
    }

    const model = this.models[this.#index % this.models.length];
    this.#index++;
    return model;
  }

  reset() {
    this.#index = 0;
  }

  getModelForRequest(requestedModel) {
    if (!requestedModel) return this.next();
    if (requestedModel === 'auto') return this.next();
    if (this.models.includes(requestedModel)) return requestedModel;

    return this.next();
  }
}

export { Router };
