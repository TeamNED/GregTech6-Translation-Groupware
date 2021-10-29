#ifndef RULEGENERATOR_H
#define RULEGENERATOR_H
#pragma once

#include <string>
#include <vector>

using std::string;
using std::vector;

#include "Generator.hpp"
#include "Rule.hpp"

class RuleGenerator : public virtual Generator {
private:
  vector<Rule> _rules;

public:
  RuleGenerator() = default;
  RuleGenerator(shared_ptr<IGeneratorMeta> meta);
  RuleGenerator(shared_ptr<IGeneratorMeta> meta, vector<Rule> rules);
  RuleGenerator(const RuleGenerator &) = default;
  RuleGenerator(RuleGenerator &&) = default;
  RuleGenerator &operator=(const RuleGenerator &) = default;
  RuleGenerator &operator=(RuleGenerator &&) = default;
  virtual ~RuleGenerator() = default;

  vector<Rule> &rules();
};
#endif