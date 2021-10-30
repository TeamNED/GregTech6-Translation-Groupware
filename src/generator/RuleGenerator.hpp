#ifndef RULEGENERATOR_H
#define RULEGENERATOR_H
#pragma once

#include "Generator.hpp"
#include "Rule.hpp"

class RuleGenerator : public virtual Generator {
private:
  vector<shared_ptr<Rule>> _rules;

public:
  RuleGenerator(shared_ptr<IGeneratorMeta> meta);
  RuleGenerator(shared_ptr<IGeneratorMeta> meta,
                vector<shared_ptr<Rule>> rules);

  vector<shared_ptr<Rule>> &rules();
  virtual vector<shared_ptr<ILangResult>> results() override;
};
#endif