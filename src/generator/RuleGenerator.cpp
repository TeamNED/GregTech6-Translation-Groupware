#include "RuleGenerator.hpp"

RuleGenerator::RuleGenerator(shared_ptr<IGeneratorMeta> meta)
    : Generator(meta) {}
RuleGenerator::RuleGenerator(shared_ptr<IGeneratorMeta> meta,
                             vector<shared_ptr<Rule>> rules)
    : Generator(meta), _rules(rules) {}
vector<shared_ptr<Rule>> &RuleGenerator::rules() { return this->_rules; }

vector<shared_ptr<ILangResult>> RuleGenerator::results() {
  vector<shared_ptr<ILangResult>> results; // TO BE CACHED
  // TODO
  return results;
}