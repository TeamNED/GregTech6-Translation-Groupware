#include "RuleGenerator.hpp"

RuleGenerator::RuleGenerator(shared_ptr<IGeneratorMeta> meta)
    : Generator(meta) {}

RuleGenerator::RuleGenerator(shared_ptr<IGeneratorMeta> meta,
                             vector<Rule> rules)
    : Generator(meta), _rules(rules) {}

vector<Rule> &RuleGenerator::rules() { return this->_rules; }