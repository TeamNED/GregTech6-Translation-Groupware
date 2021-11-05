#ifndef RULELANGRESULT_H
#define RULELANGRESULT_H
#pragma once

#include <fmt/args.h>
#include <fmt/core.h>

#include "../generator/Rule.hpp"
#include "LangResult.hpp"

class RuleLangResult : public LangResult {
  using LangResult::LangResult;

private:
  shared_ptr<Rule> _rule;
  vector<shared_ptr<ILangResult>> _subs;
  mutable LangListPointer _result = nullptr;

  LangListPointer RuleLangResult::_generate() const;

public:
  RuleLangResult(shared_ptr<IGeneratorMeta> meta, shared_ptr<Rule> rule,
                 vector<shared_ptr<ILangResult>> subs);
  shared_ptr<Rule> &rule();
  const shared_ptr<Rule> &rule() const;
  vector<shared_ptr<ILangResult>> &subs();
  const vector<shared_ptr<ILangResult>> &subs() const;
  virtual LangListPointer result() const override;
  virtual LangListPointer result(bool cached) const;
};
#endif